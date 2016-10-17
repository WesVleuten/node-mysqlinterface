var async = require('async');
var mysql = require('mysql');
var debug = require('debug')('mysqlinterface:table_define');
var sqldebug = require('debug')('mysqlinterface:query');


function capitalize(s) {
    return s && s[0].toUpperCase() + s.slice(1);
}

var Table = function(opt, cb) {
    var db = opt.connection, tablename = opt.table_name, links = opt.links, tableinterface = opt.tableinterface;

    var q = mysql.format("DESCRIBE ??", [ tablename ]);
    sqldebug(q);

    db.query(q, function(err, tableinfo) {
        if (err) return cb(err);
        var baseself = {};
        async.each(tableinfo, function(inforow, ecb) {
            if (inforow.Null == 'NO' && inforow.Default != null) {
                var type = inforow.Type.split('(').shift().toUpperCase();
                if (['TINYINT', 'SMALLINT', 'MEDIUMINT', 'INT', 'BIGINT'].indexOf(type) != -1) {
                    baseself[inforow.Field] = parseInt(inforow.Default);
                } else {
                    baseself[inforow.Field] = inforow.Default;
                }
            } else {
                baseself[inforow.Field] = null;
            }
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


                    if (reverse) {
                        self['get' + capitalize(intern.column)] = function(cb) {
                            var getter = {};
                            getter[extern.column] = self[intern.column];
                            tableinterface[extern.table].get(getter, cb);
                        };
                    } else {
                        self['get' + capitalize(extern.column)] = function(cb) {
                            var getter = {};
                            getter[extern.column] = self[intern.column];
                            tableinterface[extern.table].get(getter, cb);
                        };
                        self['new' + capitalize(extern.column)] = function(cb) {
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
                        //Replace current timestamp and now with current time
                        var selfkeys = Object.keys(self);
                        for (var i = 0; i < selfkeys.length; i++) {
                            var me = self[selfkeys[i]];
                            if (typeof me == 'function') continue;
                            if (me == 'CURRENT_TIMESTAMP' || me == 'NOW()') {
                                self[selfkeys[i]] = new Date();
                            }
                        }

                        //Parse mysql query
                        var q = mysql.format("INSERT INTO ?? SET ?", [
                            tablename,
                            self
                        ]);
                        sqldebug(q);

                        db.query(q, function (err, result) {
                            if (err) return cb(err);
                            self.id = result.insertId;
                            cb();
                        });
                        return;
                    }

                    var q = mysql.format("UPDATE ?? SET ? WHERE ?", [
                        tablename,
                        self,
                        { id: self.id }
                    ]);
                    sqldebug(q);

                    db.query(q, function (err, result) {
                        if (err) return cb(err);
                        cb();
                    });
                };

                self.delete = function(cb) {
                    if (self.id == null) return cb(new Error('Id is null'));
                    var q = mysql.format("DELETE FROM ?? WHERE ?", [
                        tablename,
                        { id: self.id }
                    ]);
                    sqldebug(q);
                    db.query(q, function(err) {
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
