const express = require("express");
const session = require("express-session");
const app = express();
const fs = require("fs");
const { JSDOM } = require('jsdom');

// static path mappings
app.use("/js", express.static("public/js"));
app.use("/css", express.static("public/css"));
app.use("/img", express.static("public/imgs"));
app.use("/fonts", express.static("public/fonts"));
app.use("/html", express.static("public/html"));
app.use("/media", express.static("public/media"));


app.use(session(
  {
      secret:"extra text that no one will guess",
      name:"wazaSessionID",
      resave: false,
      saveUninitialized: true })
);



app.get("/", function (req, res) {

    if(req.session.loggedIn) {
        res.redirect("/main");
    } else {

        let doc = fs.readFileSync("./app/html/login.html", "utf8");

        res.set("Server", "Wazubi Engine");
        res.set("X-Powered-By", "Wazubi");
        res.send(doc);

    }

});


app.get("/main", function(req, res) {

    // check for a session first!
    if(req.session.loggedIn) {

        let profile = fs.readFileSync("./app/html/main.html", "utf8");
        let profileDOM = new JSDOM(profile);

        const mysql = require("mysql2")
        const connection = mysql.createConnection({
            host: "127.0.0.1",
            user: "root",
            password: "",
            database: "userinfo"
        });
        connection.connect();
        connection.query("SELECT * FROM scores",

        function (error, results, fields) {  

            if (error){
                console.log(error);
            }

            let table = profileDOM.window.document.createElement("table");
            table.innerHTML += "<tr><th>Home Team</th><th>Away Team</th><th>Home Score</th><th>Away Score</th><th>Home Shots</th><th>Away Shots</th>";

            console.log("Results from scores table", results);

            for (let i = 0; i < results.length; i++) {
                let row = "<tr><td>" + results[i].homeTeam + "</td><td>" + results[i].awayTeam + "</td><td>" + results[i].homeScore + "</td><td>" + 
                results[i].awayScore + "</td><td>" + results[i].homeShots + "</td><td>" + results[i].awayShots + "</td></tr>";

                table.innerHTML += row;
            }
            profileDOM.window.document.getElementById("insert-here").append(table);    

            // great time to get the user's data and put it into the page!
            // profileDOM.window.document.getElementsByTagName("title")[0].innerHTML
            //     = req.session.name + "'s Profile";
            profileDOM.window.document.getElementById("profile_name").innerHTML
                = "Hello " + req.session.name;
            profileDOM.window.document.getElementById("name").innerHTML
                = req.session.name;
            profileDOM.window.document.getElementById("email").innerHTML
                = req.session.email;
            profileDOM.window.document.getElementById("city").innerHTML
                = req.session.city;
            profileDOM.window.document.getElementById("phone_number").innerHTML
                = req.session.phone_number;
            profileDOM.window.document.getElementById("school").innerHTML
                = req.session.school;
            profileDOM.window.document.getElementById("postal_code").innerHTML
                = req.session.postal_code;
    

            res.set("Server", "Wazubi Engine");
            res.set("X-Powered-By", "Wazubi");
            res.send(profileDOM.serialize());

        });

        

    } else {
        // not logged in - no session and no access, redirect to home!
        res.redirect("/");
    }

});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// Notice that this is a "POST"
app.post("/login", function(req, res) {
    res.setHeader("Content-Type", "application/json");


    console.log("What was sent", req.body.email, req.body.password);


    let results = authenticate(req.body.email, req.body.password,
        function(userRecord) {
            //console.log(rows);
            if(userRecord == null) {
                // server couldn't find that, so use AJAX response and inform
                // the user. when we get success, we will do a complete page
                // change. Ask why we would do this in lecture/lab :)
                res.send({ status: "fail", msg: "User account not found." });
            } else {
                // authenticate the user, create a session
                req.session.loggedIn = true;
                req.session.email = userRecord.email;
                req.session.name = userRecord.name;
                req.session.city = userRecord.city;
                req.session.phone_number = userRecord.phone_number;
                req.session.school = userRecord.school;
                req.session.postal_code = userRecord.postal_code;
                req.session.save(function(err) {
                    // session saved, for analytics, we could record this in a DB
                });
                // all we are doing as a server is telling the client that they
                // are logged in, it is up to them to switch to the profile page
                res.send({ status: "success", msg: "Logged in." });
            }
    });

});

app.get("/logout", function(req,res){

    if (req.session) {
        req.session.destroy(function(error) {
            if (error) {
                res.status(400).send("Unable to log out")
            } else {
                // session deleted, redirect to home
                res.redirect("/");
            }
        });
    }
});

function authenticate(email, pwd, callback) {

    const mysql = require("mysql2");
    const connection = mysql.createConnection({
      host: "127.0.0.1",
      user: "root",
      password: "",
      database: "userinfo"
    });
    connection.connect();
    connection.query(
      //'SELECT * FROM user',
      "SELECT * FROM info WHERE email = ? AND password = ?", [email, pwd],
      function(error, results, fields) {
          // results is an array of records, in JSON format
          // fields contains extra meta data about results
          console.log("Results from DB", results, "and the # of records returned", results.length);

          if (error) {
              // in production, you'd really want to send an email to admin but for now, just console
              console.log(error);
          }
          if(results.length > 0) {
              // email and password found
              return callback(results[0]);
          } else {
              // user not found
              return callback(null);
          }

      }
    );

}

/*
 * Function that connects to the DBMS and checks if the DB exists, if not
 * creates it, then populates it with a couple of records. This would be
 * removed before deploying the app but is great for
 * development/testing purposes.
 */
async function init() {

    // we'll go over promises in COMP 2537, for now know that it allows us
    // to execute some code in a synchronous manner
    const mysql = require("mysql2/promise");
    const connection = await mysql.createConnection({
      host: "127.0.0.1",
      user: "root",
      password: "",
      multipleStatements: true
    });
    const createDBAndTables = `CREATE DATABASE IF NOT EXISTS userinfo;
        use userinfo;
        CREATE TABLE IF NOT EXISTS info (
        ID int NOT NULL AUTO_INCREMENT,
            name varchar(30),
            email varchar(30),
            password varchar(30),
            city varchar(30),
            phone_number varchar(12),
            school varchar(30),
            postal_code varchar(7),
            PRIMARY KEY (ID));

        CREATE TABLE IF NOT EXISTS scores (
        ID int NOT NULL AUTO_INCREMENT,
            homeTeam varchar(30),
            awayTeam varchar(30),
            homeScore varchar(30),
            awayScore varchar(30),
            homeShots varchar(30),
            awayShots varchar(30),
            PRIMARY KEY (ID));`;
        
    await connection.query(createDBAndTables);

    
    


    // await allows for us to wait for this line to execute ... synchronously
    // also ... destructuring. There's that term again!
    const [rows, fields] = await connection.query("SELECT * FROM info");
    // no records? Let's add a couple - for testing purposes
    if(rows.length == 0) {
        // no records, so let's add a couple
        let userRecords = "insert into info (name, email, password, city, phone_number, school, postal_code) values ?";
        let recordValues = [
          ["Arron", "arron_ferguson@bcit.ca", "abc123", "Vancouver", "604-123-4567", "BCIT", "A1B 2D3"],
          ["Bob", "Bobthebuilder@gmail.com", "abc123", "Whiterock", "604-321-4567", "BCIT", "B1A 2D3"],
          ["Prab", "prab@gmail.com", "abc123", "Surrey", "604-111-4567", "BCIT", "2D3 A1B"]
        ];
        await connection.query(userRecords, [recordValues]);
    }
        

    const [hockeyRows, hockeyField] = await connection.query("SELECT * FROM scores");
    // no records? Let's add a couple - for testing purposes
    if(hockeyRows.length == 0) {
        // no records, so let's add a couple
        let hockeyRecords = "insert into scores (homeTeam, awayTeam, homeScore, awayScore, homeShots, awayShots) values ?";
        let hockeyResults = [
            ["Detroit", "Vancouver", "2", "2", "17", "14"],
            ["Montreal", "Ottawa", "2", "2", "17", "14"],
            ["Chicago", "Seattle", "1", "4", "26", "29"],
            ["Calgary", "Edmonton", "3", "4", "27", "34"],
            ["Pittsburgh", "Minnesota", "0", "0", "27", "14"],
            ["Buffalo", "Winnipeg", "1", "3", "18", "29"],
            ["Tampa Bay", "St. Louis", "1", "2", "14", "14"],
            ["Florida", "San Jose", "6", "2", "37", "24"],
            ["Carolina", "Colorado", "1", "1", "28", "29"],
            ["Philidelphia", "Vegas", "3", "0", "17", "19"],
        ];
    
        await connection.query(hockeyRecords, [hockeyResults]);
    }
    
    console.log("Listening on port " + port + "!");
}

// RUN SERVER
let port = 8000;
app.listen(port, init);
