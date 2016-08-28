var async = require('async');
var Table = require('./table.js');

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

module.exports = exports = TableInterface;
