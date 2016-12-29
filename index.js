var mysql = require('mysql');
var async = require('async');
var debug = require('debug')('mysqlinterface:main');
var debugconnection = require('debug')('mysqlinterface:connection');
var _ = require('underscore');
var TableInterface = require('./tableinterface.js');
var sqldebug = require('debug')('mysqlinterface:query');

module.exports = function mysqlTI(opt, scb) {
    var db = function() {
        var idb = null;
        var connected = false;

        var returner = {
            connect: function(cb) {
                idb = mysql.createConnection(opt);

                idb.connect(function(err) {
                    if (err) {
                        debugconnection('Couldnt connect, retrying in 2 seconds...');
                        connected = false;
                        setTimeout(this.connect, 2000);
                        return;
                    }
                    debugconnection('Connected!');
                    connected = true;
                    if (typeof cb == 'function') cb();
                });

                idb.on('error', function(err) {
                    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
                        debugconnection('Disconnected!');
                        connected = false;
                    } else {
                        throw err;
                    }
                });

            },
            query: function(a, b, c) {
                var doquery = function() {
                    idb.query(a, b, c);
                };
                if (!connected) {
                    this.connect(doquery);
                } else {
                    doquery();
                }
            },
            end: function(cb) {
                connected = false;
                return dbi.end(cb);
            },
            escape: function(str) {
                return dbi.escape(str);
            }

        };
        return returner;
    }();

    var database = {
	    query: function(a,b,c) {
            return db.query(a, b, c);
        },
	    escape: function(a) {
            return db.escape(a);
        },
        getDB: function(cb) {
            if (db)
                cb(null, db);
            else
                cb(true);
        },
        close: function(cb) {
            db.end(function(err) {
                if (cb) return cb(err);
                if (err) throw new Error('Couldnt end dbcon', err);
            });
        }
    };
    async.parallel([
        function getDatabase(spcb) {
            async.series({
                links: function(pcb) {
                    var q = mysql.format("SELECT TABLE_NAME,COLUMN_NAME,CONSTRAINT_NAME,REFERENCED_TABLE_NAME,REFERENCED_COLUMN_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE WHERE REFERENCED_COLUMN_NAME IS NOT NULL AND TABLE_SCHEMA = ?", [ opt.database ]);
                    sqldebug(q);
                    db.query(q, function(err, result) {
                        if (err) return pcb(err);
                        var returner = [];
                        async.each(result, function(con, ecb) {
                            returner.push([
                                {
                                    table: con.TABLE_NAME,
                                    column: con.COLUMN_NAME
                                }, {
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
                    var q = mysql.format("SELECT TABLE_NAME as 'name' FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = ?", [ opt.database ]);
                    sqldebug(q);
                    db.query(q, function(err, tables) {
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
                    spcb(err)
                });
            });
        },
        function getProcedures(spcb) {
            spcb();
        }
    ], function mainpDone(err) {
        scb(err, database);

    });

};
