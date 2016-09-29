var async = require('async');
var debug = require('debug')('mysqlinterface:interface');
var Table = require('./table.js');

var TableInterface = function(opt, cb) {
    var db = opt.connection, tablename = opt.table_name;

    new Table(opt, function(err, baseObject) {
        if (err) return cb(err);

        cb(null, {
            get: function(obj, cb) {
	            if (typeof obj == 'number') obj = {id: obj};

                var sqlquery = 'SELECT * FROM ?? WHERE';
                var values = [tablename];
                var objk = Object.keys(obj);
                for (var i = 0; i < objk.length; i++) {
                    values.push(objk[i], obj[objk[i]]);
                    if (i != 0) sqlquery += ' &&';
                    sqlquery += ' ?? = ?';
                }

                db.query(sqlquery, values, function(err, data) {
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

module.exports = exports = TableInterface;
