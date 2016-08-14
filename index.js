var mysql = require('mysql');
var async = require('async');
var _ = require('underscore');
var mysqltypes = [
    {
        types: [ 'CHAR', 'VARCHAR', 'TINYTEXT', 'TEXT', 'MEDIUMTEXT', 'LONGTEXT' ],
        default: ''
    }
];

var TableInterface = function(opt, cb) {
    var db = opt.connection, tablename = opt.table_name;

    new Table(opt, function(err, baseObject) {
        if (err) return cb(err);

        cb(null, {
            get: function(obj, cb) {
                db.query('SELECT * FROM ?? WHERE ?', [tablename, obj], function(err, data) {
                    if (err) return cb(err);
                    if (data.length == 0) return cb(null, []);
                    var returner = [];
                    async.each(data, function(rawbaseobject, ecb) {
                        returner.push(new baseObject(rawbaseobject));
                    });
                    cb(null, returner);
                });
            },
            new: function(cb) {
                cb(null, new baseObject())
            }
        });
    });
}

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
                var self = givenbase || baseself;

                for (var i = 0; i < links.length; i++) {
                    var link = links[i];

                    var extern = link[1];
                    var intern = link[0];
                    if (link[1].table == tablename) {
                        extern = link[0];
                        intern = link[1];
                    }

                    self['get' + extern.table] = function(cb) {
                        var getter = {};
                        getter[extern.column] = self[intern.column];
                        tableinterface[extern.table].get(getter, cb);
                    };
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

module.exports = function mysqlTI(opt, scb) {
    var db = mysql.createConnection(opt);
    var database = {};

    async.parallel({
        links: function(pcb) {
            db.query("SELECT TABLE_NAME,COLUMN_NAME,CONSTRAINT_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE REFERENCED_COLUMN_NAME IS NOT NULL AND TABLE_SCHEMA = ?", [ opt.database ], function(err, result) {
                if (err) return pcb(err);
                var returner = [];
                async.each(result, function(con, ecb) {
                    returner.push([
                        {
                            table: con.TABLE_NAME,
                            column: con.COLUMN_NAME
                        },
                        {
                            table: con.REFERENCED_TABLE_NAME,
                            column: con.REFERENCED_COLUMN_NAME
                        }
                    ]);
                    ecb();
                }, function(err) {
                    pcb(err, returner);
                });
            });
        },
        table: function(cb) {
            db.query("SELECT TABLE_NAME as 'name' FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = ?", [ opt.database ], function(err, tables) {
                if (err) return cb(err);
                cb(err, tables);
            });
        }
    }, function(err, result) {
        if (err) return scb(err);
        async.each(result.table, function(table, ecb) {
            new TableInterface({
                connection: db,
                table_name: table.name,
                links: _.filter(result.links, function(x) { return x[0].table == table.name || x[1].table == table.name; }),
                tableinterface: database
            }, function(err, t) {
                if (err) return ecb(err);
                database[table.name] = t;
                ecb();
            });
        }, function(err) {
            scb(err, database);
        });
    });
};
