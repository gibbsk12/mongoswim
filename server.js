var express = require("express");
var bodyParser = require("body-parser");
var logger = require("morgan");
var mongoose = require("mongoose");
var request = require("request");
var cheerio = require("cheerio");
var exphbs = require("express-handlebars");
var Note = require("./models/Note");
var Article = require("./models/Article");
var port = process.env.PORT || 4040;
var app = express();
var path = require("path");

app.use(logger("dev"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// mongoose.connect("mongodb://localhost/swimmingdb");
var MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost/swimmingdb";
mongoose.Promise = Promise;
mongoose.connect(MONGODB_URI);

app.engine("handlebars", exphbs({
  defaultLayout: "main",
  partialsDir: path.join(__dirname, "/views/layouts/partials")
}));
app.set("view engine", "handlebars");

//Handlebars for Home Page
app.get("/", function(req, res) {
  Article.deleteMany({ title: "" }, function (err) {    //Necessary to remove advertisements from db
    if (err) throw err;
  });
  Article.find({}, function(error, data) {
    var hbNewsObject = {
      article: data
    };
    console.log(hbNewsObject);
    res.render("home", hbNewsObject);
  });
});

//Handlebars for Saved Articles 
app.get("/saved", function(req, res) {
  Article.find({"saved": true}).populate("notes").exec(function(error, articles) {
    var hbsObject = {
      article: articles
    };
    res.render("saved", hbsObject);
  });
});

//Scrape the Webpage AND push to the database 
app.get('/scrape', function (req, res) { //Scrapes the SwimSwam Site
  request("https://swimswam.com/news/", function (error, response, html) {
    var $ = cheerio.load(html);
    var results = {};
    $("div.item").each(function (i, element) {
      var title = $(element).children("h4").children("a").text();
      var link = $(element).children("div").children("a").attr("href");
      var summary = $(element).children("p").text();
      if (title) {
        results.title = title;
        results.link = link;
        results.summary = summary;
      } else {
        results.title = $(element).children("h3").children("a").text();
        results.link = link;
        results.summary = summary;
      };
      var entry = new Article(results);
      Article.find({ title: results.title }, function (err, data) {
        if (data.length === 0) {
          entry.save(function (err) {
            if (err) throw err;
          });
        }
      });
    });
    res.send("Scrape complete.")
  });
})

//Creates /articles page 
app.get("/articles", function(req, res){ //Grabs all articles 
  Article.deleteMany({ title: "" }, function (err) {    //Necessary to remove advertisements from db
    if (err) throw err;
  });
  Article.find({})
  .then(function(dbArticle){
    res.json(dbArticle);
  })
  .catch(function(err) {
    res.json(err);
  });
})


app.get("/articles/:id", function(req, res) { //Grabbing a specific article 
  Article.findOne({ "_id": req.params.id })
  .populate("note")
  .exec(function(error, doc) {
    if (error) {
      console.log(error);
    }
    else {
      res.json(doc);
    }
  });
});

app.post("/articles/save/:id", function(req, res) { //Saving an article
  Article.findOneAndUpdate({ "_id": req.params.id }, { "saved": true})
  .exec(function(err, doc) {
    if (err) {
      console.log(err);
    }
    else {
      res.send(doc);
    }
  });
});

app.post("/articles/delete/:id", function(req, res) { //Delete an article 
  Article.findOneAndUpdate({ "_id": req.params.id }, {"saved": false, "notes": []})
  .exec(function(err, doc) {
    if (err) {
      console.log(err);
    }
    else {
      res.send(doc);
    }
  });
});

app.post("/notes/save/:id", function(req, res) { //Create a new note
  var newNote = new Note({
    body: req.body.text,
    article: req.params.id
  });
  console.log(req.body)
  newNote.save(function(error, note) {
    if (error) {
      console.log(error);
    }
    else {
      Article.findOneAndUpdate({ "_id": req.params.id }, {$push: { "notes": note } })
      .exec(function(err) {
        if (err) {
          console.log(err);
          res.send(err);
        }
        else {
          res.send(note);
        }
      });
    }
  });
});

app.delete("/notes/delete/:note_id/:article_id", function(req, res) { //Delete a Note
  Note.findOneAndRemove({ "_id": req.params.note_id }, function(err) {
    if (err) {
      console.log(err);
      res.send(err);
    }
    else {
      Article.findOneAndUpdate({ "_id": req.params.article_id }, {$pull: {"notes": req.params.note_id}})
        .exec(function(err) {
          if (err) {
            console.log(err);
            res.send(err);
          }
          else {
            res.send("Note Deleted");
          }
        });
    }
  });
});

app.listen(port, function () {
  console.log("App running on port " + port + "!");
});



