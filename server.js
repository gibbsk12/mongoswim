var express = require("express");
var bodyParser = require("body-parser");
var logger = require("morgan");
var mongoose = require("mongoose");
var request = require("request");
var cheerio = require("cheerio");

var Note = require("./models/Note");
var Article = require("./models/Article");
var PORT = 4040;
var app = express();

app.use(logger("dev"));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

mongoose.connect("mongodb://localhost/swimmingdb");

app.get('/scrape', function (req, res) {
  request("https://swimswam.com/news/", function (error, response, html) {
    var $ = cheerio.load(html);
    var results = {};
    $("div.item").each(function (i, element) {
      var title = $(element).children("h4").children("a").text();
      var link = $(element).children("div").children("a").attr("href");
      var summary = $(element).children("p").text();
      var imgLink = $(element).children("div").children("a").children("img").attr("src");
      if (title) {
        results.title = title;
        results.link = link;
        results.summary = summary;
        results.imgLink = imgLink;
      } else {
        results.title = $(element).children("h3").children("a").text();
        results.link = link;
        results.summary = summary;
        results.imgLink = imgLink;
      };
      var entry = new Article(results);
      Article.find({ title: results.title }, function (err, data) {
        if (data.length === 0) {
          entry.save(function (err) {
            if (err) throw err;
          });
        }
      });
      Article.remove({ title: "" }, function (err) {
        if (err) throw err;
      });

    });



    console.log("Scrape complete.")
  });
})


app.listen(PORT, function () {
  console.log("App running on port " + PORT + "!");
});



