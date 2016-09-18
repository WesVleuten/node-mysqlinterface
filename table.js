var async = require('async');

var Table = function(opt, cb) {
    var db = opt.connection, tablename = opt.table_name, links = opt.links, tableinterface = opt.tableinterface;

    db.query("DESCRIBE ??", [tablename], function(err, tableinfo) {
        if (err) return cb(err);
        var baseself = {};
        async.each(tableinfo, function(inforow, ecb) {
            baseself[inforow.Field] = null;
            ecb();
        }, function() {
            cb(null, function(givenbase) {
                var self = Object.assign({}, givenbase || baseself);

                for (var i = 0; i < links.length; i++) {
                    var link = links[i];

                    var extern = link[0];
                    var intern = link[1];
                    var reverse = false;
                    if (link[0].table == tablename) {
                        extern = link[1];
                        intern = link[0];
                        reverse = true;
                    }

                    self['get' + extern.table] = function(cb) {
                        var getter = {};
                        getter[extern.column] = self[intern.column];
                        tableinterface[extern.table].get(getter, cb);
                    };
                    if (!reverse) {
                        self['new' + extern.table] = function(cb) {
                            tableinterface[extern.table].new(function(err, newobject) {
                                if (err) return cb(err);
                                newobject[extern.column] = self[intern.column];
                                cb(null, newobject);
                            });
                        };
                    }
                }

                self.save = function(cb) {
                    if (self.id == null) {
                        db.query("INSERT INTO ?? SET ?", [
                            tablename,
                            self
                        ], function (err, result) {
                            if (err) return cb(err);
                            self.id = result.insertId;
                            cb();
                        });
                        return;
                    }
                    db.query("UPDATE ?? SET ? WHERE ?", [
                        tablename,
                        self,
                        { id: self.id }
                    ], function (err, result) {
                        if (err) return cb(err);
                        cb();
                    });
                };

                self.delete = function(cb) {
                    if (self.id == null) return cb(new Error('Id is null'));
                    db.query("DELETE FROM ?? WHERE ?", [
                        tablename,
                        { id: self.id }
                    ], function(err) {
                        if (err) return cb(err);
                        self.id = null;
                        cb();
                    });
                };

                return self;
            });
        });
    });
};

module.exports = exports = Table;
