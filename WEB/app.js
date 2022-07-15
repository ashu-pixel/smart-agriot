const express = require("express")
const bodyParser = require("body-parser")
require('dotenv').config()
const fetch = require('node-fetch');
const cookieParser = require("cookie-parser");
const sessions = require('express-session');
const app = express()
app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static("public"))
app.set('view engine', 'ejs');
app.use(cookieParser());
app.use(sessions({
    secret: process.env.SECRET ,
    saveUninitialized:true,
    resave: false
}));
app.use(express.json()); // parsing the incoming data
// cookie parser middleware
let session;
let valid = false


// const favicon = require('serve-favicon');
// var path = require('path')
// app.use(favicon(path.join(__dirname, 'public', 'images', 'favicon.ico')))
// app.use('/favicon.ico', express.static('images/favicon.ico'));

const homePage = require('./data/hm.json')
const precisionPage = require('./data/precision.json')
const nutriThresholds = require('./data/soil.json')
const fertilizer = require('./data/fertilizer.json')
const deficient = require('./data/nutriDefi.json')
const enrich = require('./data/nutriEnrich.json')
const teamInfo = require('./data/info.json')

app.get("/", function(req, res) {
    res.render("home", { data: homePage })
})

app.get("/qgisPage", function(req, res) {
    res.render("index")
})


app.get("/CropPrediction", function(req, res) {
    res.render("CropPrediction", { info: "Fill out form" })
})

app.post("/CropPrediction", async function(req, res) {
     
    params = ["season", "temp", "humi", "rainfall", "soil"]  
    obj = {} 

    for(key of params ){
        obj[key] = req.body[key]
    }
     
    const rawResponse = await fetch(`https://smart-web-apis.herokuapp.com/${process.env.PATH1}`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(obj)
      });
    const content = await rawResponse.json();
    
    res.render("CropPrediction", { info: "Cultivating '" + content.val +"' would earn you profits!" })  
})



app.get("/PrecisionAgriculture", function(req, res) {
    res.render("precisionAgri", { data: precisionPage, links: {} })
})

app.post("/PrecisionAgriculture", function(req, res) {
     
    res.render("precisionAgri", { data: precisionPage, links: precisionPage[req.body.crop] })
})


 


app.get("/SmartFarming", function(req, res) {
    session=req.session; 
    
    if(session.userid){
        res.render("smartFarm" , {nutriThresholds : nutriThresholds } )
    }else{
        res.render('login' , {invalid : valid})
    }
    
}) 

 

app.post("/login", function(req, res) {
    const {userN , passW} = req.body
    
    if(passW == process.env.PASSWORD && userN == process.env.WEBNAME){
        session=req.session;
        session.userid=userN;
         
    } 
    valid = true
    res.redirect(301, "/SmartFarming")
})


app.get('/logout',(req,res) => {
    valid = false
    req.session.destroy();
    res.redirect('/');
});

app.get("/Weather", function(req, res) {
    res.render("weather" , {weather : "Weather" , info: "" , api:process.env.WEATHERAPI})
})


app.post("/weatherPred", async function(req, res) {
    
    const {url} = req.body 
    params = ["temp", "humi", "press" , "visibility","windS", "windD" ]
    obj = {}
    for(key of params ){
        obj[key] = req.body[key]
    }
     
    const rawResponse = await fetch(`https://smart-web-apis.herokuapp.com/${process.env.PATH2}`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(obj)
      });
    const content = await rawResponse.json();
      
    res.render("weather" , {weather : "Weather" , info: content.val , url:url , api:process.env.WEATHERAPI} )
})

app.get("/currConditions/:cty" , async function(req , res){
    const val = req.params.cty  
     
    const resp = await fetch(`https://api.weatherapi.com/v1/current.json?key=${process.env.WEATHERAPI}&q=${val}&aqi=no`)
    const data = await resp.json(); //extract JSON from the http response
     
    res.json(data)
})

app.get("/soil/:frt", function(req, res) {
    const frt = req.params.frt
     
    res.json({
        Thresholds : nutriThresholds[frt] , 
        fertilizer : fertilizer[frt] , 
        deficient : deficient  , 
        enrich : enrich
    })
})

app.get("/firebase", async function(req, res) {
    const resp = await fetch(`https://smart-agriot-default-${process.env.FIREBASECODE}.firebaseio.com/.json`)
    const data = await resp.json(); //extract JSON from the http response
    
    res.json(data)
})

app.get("/firebase/:sValve/:state", async function(req, res) {
    session=req.session; 
    
    if(!session.userid){
        res.redirect("/SmartFarming")
    } 

    obj = {}
    state = req.params.state
    if(req.params.sValve === "mode"){
        obj["mode"] = state
        obj["p1"] = "0"
        obj["p2"] = "0"
        obj["p3"] = "0"
    }else{
        valve = parseInt(req.params.sValve)
        if(valve === 1){ obj["p1"] = state}
        else if(valve === 2){ obj["p2"] = state}
        if(valve === 3){ obj["p3"] = state}
    }
    
    const resp = await fetch(`https://smart-agriot-default-${process.env.FIREBASECODE}.firebaseio.com/.json` , {
        method: 'PATCH',
        body: JSON.stringify(obj)
    })
    const data = await resp.json(); //extract JSON from the http response
     
    res.json(data)
 
})




app.get("/abt", function(req, res) {
res.render("about" , {info : teamInfo})
})


app.listen(process.env.PORT || 3000, function() {
    console.log("Running on Port 3000")
    
})