# node-mysqlinterface

Easy way to objectify a MySQL database. This module uses constraints to link multiple tables to each other.

Written and tested with MySQL 5.6.26. If any issues occur with the sql queries please open an issue.



## Example: getting a user form the User table

First you have to install
```
npm install https://github.com/WesVleuten/node-mysqlinterface.git
```

Then you can run this example code
```
var mysqlinterface = require('node-mysqlinterface');

mysqlinterface({
    host: 'host',
    user: 'user_name',
    password: 'user_pass',
    database: 'database_name'
}, function(err, database) {

    database.User.get({id: 1}, function(err, user) {
        console.log(user);
    });

});
```

### Author
Made by Wes van der Vleuten
