var async = require('async');
var mysql = require('mysql');
var debug = require('debug')('mysqlinterface:interface');
var sqldebuglog = require('debug')('mysqlinterface:query');
var sqldebug = function (msg) { return sqldebuglog(msg.slice(0,500)); }
var Table = require('./table.js');

var generateInterface = function(db, tablename, baseObject) {
    var self = {
        //Simple get by obj method
        get: function(obj, cb) {
            //Check if no object was passed or if object is empty, if the case redirect to get all
            if (!obj || Object.keys(obj).length == 0) return self.getAll(cb);

            //If obj is number use it as id in filter
            if (typeof obj == 'number') obj = {id: obj};

            //Default template of sql query
            var sqlquery = 'SELECT * FROM ?? WHERE';

            //Values include tablename for proper escape
            var values = [tablename];

            //Loop through object to create where statement
            var objk = Object.keys(obj);
            for (var i = 0; i < objk.length; i++) {
                var key = objk[i];
                var val = obj[key];
                values.push(key);
                if (i != 0) sqlquery += ' &&';

                if (val === null) {
                    sqlquery += ' ?? IS NULL';
                } else {
                    values.push(val);
                    sqlquery += ' ?? = ?';
                }

            }

            //format and log query
            var q = mysql.format(sqlquery, values);
            sqldebug(q);

            //Do query
            db.query(q, function(err, data) {
                //If error occured report accordingly
                if (err) return cb(err);

                self.parseRawObject(err, data, cb);
            });
        },
        //Get all objects from table
        //WARNING: for large tables this is a resource expensive task
        getAll: function(cb) {
            //Format and Log
            var q = mysql.format('SELECT * FROM ??', [tablename]);
            sqldebug(q);

            //Directly get all rows from table
            db.query(q, function(err, data) {
                //If error occured report accordingly
                if (err) return cb(err);

                self.parseRawObject(err, data, cb);
            });
        },
        //Get one object by id
        getById: function(id, cb) {
            //Use internal object to fetch object
            self.get({
                id: id
            }, function(err, objects) {
                if (err) return cb(err);
                //Disallow multiple identifiers
                if (objects.length > 1) return cb('Multiple ids found');
                //Prevent not found error wihtin array
                if (objects.length < 1) return cb(null, []);
                //Return single object
                return cb(err, objects[0]);
            });
        },
        //Create new object
        new: function(cb) {
            //Create empty object
            cb(null, new baseObject())
        },
        //Function allows usage of safe custom queries
        query: function(sqlraw, sqlvalues, cb) {
            //Add tablename if it is not in the sqlvalues list
            if (sqlvalues.indexOf(tablename) != 0) sqlvalues.unshift(tablename);

            //Format sql statement
            var q = mysql.format(sqlraw, sqlvalues);

            //Log to debug
            sqldebug(q);

            //Run query
            db.query(q, function(err, data) {
                //If error occured report accordingly
                if (err) return cb(err);

                self.parseRawObject(err, data, cb);
            });
        },
        //Parse raw objects for easy usage
        parseRawObject: function (err, data, cb) {
            //If no data has been returned prevent loop
            if (data.length == 0) return cb(null, []);

            //Create objects and pass them to callback
            var returner = [];
            async.each(data, function(rawbaseobject, ecb) {
                returner.push(new baseObject(rawbaseobject));
                ecb();
            }, function() {
                cb(null, returner);
            });
        }
    };
    return self;
};

var TableInterface = function(opt, cb) {
    var db = opt.connection,
        tablename = opt.table_name;

    new Table(opt, function(err, baseObject) {
        if (err) return cb(err);
        cb(null, generateInterface(db, tablename, baseObject));
        //Log that initialization was succesful
        debug(tablename + ' initialized');
    });
}

//Make table interface publicly avalible
module.exports = exports = TableInterface;
