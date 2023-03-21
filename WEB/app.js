const express = require("express")
const bodyParser = require("body-parser")
require('dotenv').config()
const fetch = require('node-fetch');
const cookieParser = require("cookie-parser");
const sessions = require('express-session');
const app = express()
var admin = require("firebase-admin");
const multer = require('multer')
const fs = require("fs");

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './tmp')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, file.fieldname + '-' + uniqueSuffix + '.png')
    }
})

const upload = multer({ storage: storage })
const { Storage } = require('@google-cloud/storage');
const UUID = require("uuid4")
const path = require('path');

app.use(bodyParser.urlencoded({ extended: true }))
app.use(express.static(__dirname + "/public"))
app.set('view engine', 'ejs');
app.use(cookieParser());
app.use(sessions({
    secret: process.env.SECRET,
    saveUninitialized: true,
    resave: false
}));
app.use(express.json()); // parsing the incoming data


let session;
let valid = false // flag for checking password


var serviceAccount = require("./config.json");
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.DATABASEURL,
    storageBucket: process.env.BUCKET_URL
});
const db = admin.firestore()

const firebaseStorage = new Storage({
    keyFilename: "config.json",
});


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


// middleware functions  
var sessionChecker = (req, res, next) => {
    if (req.session.userid) {
        next();
    } else {
        res.render('login', { invalid: valid });
    }
};

var sessionCheckerFarmer = (req, res, next) => {
    if (req.session.userid) {
        if (req.session.role == 'farmer') next();
        else res.send("UNAUTHORIZED")
    } else {
        res.render('login', { invalid: valid });
    }
};


var sessionCheckerExpert = (req, res, next) => {
    if (req.session.userid) {
        if (req.session.role == 'expert') next();
        else res.send("UNAUTHORIZED")
    } else {
        res.render('login', { invalid: valid });
    }
};


// routes
app.get("/", function (req, res) {
    session = req.session;
    const isLoggedIn = session.userid ? true : false
    let role = "farmer"
    if (isLoggedIn) role = session.role
    res.render("home", { data: homePage, isLoggedIn, role })
})

app.get("/qgisPage", sessionCheckerFarmer, function (req, res) {
    res.render("qgisTracking")
})

app.get("/CropPrediction", sessionCheckerFarmer, function (req, res) {
    res.render("CropPrediction", { info: "Fill out form" })
})

app.post("/CropPrediction", sessionCheckerFarmer, async function (req, res) {

    params = ["nitrogen", "phosphorus", "potassium", "temp", "humi", "pH", "rainfall"]
    obj = {
        formVals: [],
        marketVals: {}
    }

    for (key of params) { obj.formVals.push(parseFloat(req.body[key])) }

    const marketRef = await db.collection("market requirements").doc("Dy9MV98vtc33sJbhKYHt").get()
    const crops = marketRef.data()

    for (const crop in crops) {
        obj.marketVals[crop] = parseInt(crops[crop])
    }

    const rawResponse = await fetch(" http://127.0.0.1:5000/CropPred", {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(obj)
    });
    const content = await rawResponse.json();
    const { res1, res2, res3 } = content
    const val = `${res1}, ${res2} or ${res3}`
    res.render("CropPrediction", { info: "Cultivating '" + val + "' would earn you profits!" })
})

app.get("/PrecisionAgriculture", sessionCheckerFarmer, function (req, res) {
    res.render("precisionAgri", { data: precisionPage, links: {} })
})

app.post("/PrecisionAgriculture", function (req, res) {
    res.render("precisionAgri", { data: precisionPage, links: precisionPage[req.body.crop] })
})

app.get("/SmartFarming", sessionCheckerFarmer, function (req, res) {
    session = req.session;

    if (session.userid) {
        res.render("smartFarm", { nutriThresholds: nutriThresholds })
    } else {
        res.render('login', { invalid: valid })
    }
})

app.get("/login", sessionChecker, function (req, res) {
    // just a route middleware will take care of res
})

app.post("/login", function (req, res) {
    const { userN, passW } = req.body

    db.collection("USER").doc(`${userN}`).get()
        .then(doc => {

            if (doc.exists && doc.data().Password == passW) {

                session = req.session;
                session.userid = doc.id;
                session.role = doc.data().Role;
                session.name = doc.data().Name;
                session.address = doc.data().Address;
                session.phone = doc.data().Phone;
                if (doc.data().Role == 'farmer') res.redirect(301, "/qgisPage")
                else if (doc.data().Role == 'expert') res.redirect(301, "/appointment")
            } else {
                valid = true
                res.render('login', { invalid: valid })
            }

        })
        .catch(e => { console.log("ERROR") })

    // if (userN == '1001' && passW == 'Pass') {
    //     session = req.session;
    //     session.userid = userN;
    //     session.role = "farmer" ;
    //     res.redirect(301, "/SmartFarming")
    // } else {
    //     valid = true
    //     res.render('login', { invalid: valid })
    // }
})

app.get('/logout', (req, res) => {
    valid = false
    req.session.destroy();
    res.redirect('/');
});

app.get("/Weather", sessionCheckerFarmer, function (req, res) {
    res.render("weather", { weather: "Weather", info: "", api: process.env.WEATHERAPI })
})

app.post("/weatherPred", sessionCheckerFarmer, async function (req, res) {

    const { url } = req.body

    params = ["temp", "humi", "windS", "press", "windD", "visibility"]
    obj = {
        formVals: []
    }
    for (key of params) {
        obj["formVals"].push(parseFloat(req.body[key]))
    }

    const rawResponse = await fetch("http://127.0.0.1:5000/weatherPred", {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(obj)
    });
    const content = await rawResponse.json();

    res.render("weather", { weather: "Weather", info: content.val, url: url, api: process.env.WEATHERAPI })
})

app.get("/currCityConditions/:cty", async function (req, res) {
    const val = req.params.cty
    const resp = await fetch(`https://api.weatherapi.com/v1/current.json?key=${process.env.WEATHERAPI}&q=${val}&aqi=no`)
    const data = await resp.json();
    res.json(data)
})

app.get("/soil/:frt", function (req, res) {
    const frt = req.params.frt

    res.json({
        Thresholds: nutriThresholds[frt],
        fertilizer: fertilizer[frt],
        deficient: deficient,
        enrich: enrich
    })
})

app.get("/dhtSensorVals", sessionCheckerFarmer, async function (req, res) {

    session = req.session;

    db.collection("Farm").doc(`${session.userid}`).get()
        .then(doc => {

            if (doc.exists) {
                farmData = doc.data()
                const data = {
                    Humidity: farmData.humid,
                    Temperature: farmData.temp
                }

                res.json(data)
            }
        })
        .catch(e => { console.log("ERROR") })
})

app.get("/firebase/:sValve/:state", async function (req, res) {
    session = req.session;

    if (!session.userid) {
        res.redirect("/SmartFarming")
    }

    obj = {}
    state = req.params.state
    if (req.params.sValve === "mode") {
        obj["mode"] = state
        obj["p1"] = "0"
        obj["p2"] = "0"
        obj["p3"] = "0"
    } else {
        valve = parseInt(req.params.sValve)
        if (valve === 1) { obj["p1"] = state }
        else if (valve === 2) { obj["p2"] = state }
        if (valve === 3) { obj["p3"] = state }
    }

    const resp = await fetch(`https://smart-agriot-default-${process.env.FIREBASECODE}.firebaseio.com/.json`, {
        method: 'PATCH',
        body: JSON.stringify(obj)
    })
    const data = await resp.json();

    res.json(data)
})

app.get("/plantDoctor", sessionCheckerFarmer, async function (req, res) {
    session = req.session;
    const queryRef = db.collection('Consultation');
    const doc = await queryRef.where('farmer_id', '==', session.userid).get();

    let alreadyRaised = false
    let prev = []

    doc.forEach(d => {

        if (d.data().status == 'solved') { prev.push(d.data()) }
        else { alreadyRaised = d.data() }
    })

    res.render("diseaseDetect", { alreadyRaised, prev })
})

app.post("/raiseReq", sessionCheckerFarmer, function (req, res) {

    session = req.session;

    const d = new Date();
    const data = {
        farmer_id: session.userid,
        date_generate: `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`,
        status: "generated",
        date_solved: "",
        remark: ''
    }
    if (req.body.URL) data.image = req.body.URL

    db.collection("Consultation").doc().set(data)
        .then(() => res.json({ status: 200 }))
        .catch(() => res.json({ status: 503 }))
})

app.get("/appointment", sessionCheckerExpert, async function (req, res) {

    const queryRef = db.collection('Consultation');
    const userRef = db.collection('USER');
    const doc = await queryRef.where('status', '==', "generated").get();
    let query = []

    doc.forEach(async (d) => {

        document = d.data()
        document.docID = d.id
        query.push(document)
    })
    for (let q of query) {
        const userinfo = await userRef.doc(q.farmer_id).get();
        q.name = userinfo.data().Name
    }

    res.render("expert/appointment", { query })
})

app.get("/specific/:userID", sessionCheckerExpert, async function (req, res) {

    const userID = req.params.userID

    const farmRef = db.collection('Farm');
    const farmInfo = await farmRef.doc(userID).get();

    if (!farmInfo.exists) {
        res.send("Error 404 : NO USER FOUND")
        return
    }
    const userRef = db.collection('USER');
    const userInfo = await userRef.doc(userID).get();
    user = userInfo.data()
    const farmData = farmInfo.data()

    const queryRef = db.collection('Consultation');
    const queryInfo = await queryRef.where("farmer_id", "==", userID).get();
    let currQuery
    let prevQuery = []

    queryInfo.forEach((d) => {
        document = d.data()
        document.docID = d.id
        if (document.status == 'solved') prevQuery.push(document)
        else currQuery = document
    })

    res.render("expert/specificUser", { farmData, currQuery, prevQuery, user })
})

app.post("/resolveQ/:docID", sessionCheckerExpert, async function (req, res) {

    const { docID } = req.params
    const { remark } = req.body

    const d = new Date()
    const queryRef = db.collection('Consultation').doc(docID);

    // delete image uploaded by user
    const query = await queryRef.get()
    if (query.data().image) {
        const imgURL = query.data().image ; 
        let startIndx = imgURL.indexOf("myFile");
        let endIndx = imgURL.indexOf("?");
        let imgName = imgURL.substring(startIndx, endIndx);
        await firebaseStorage.bucket(process.env.BUCKET_URL).file("userImg/" + imgName).delete();
    }
 
    const data = {
        status: "solved",
        remark: remark ? remark : "None",
        date_solved: `${d.getDate()}-${d.getMonth() + 1}-${d.getFullYear()}`
    }
    const resUpdate = await queryRef.set(data, { merge: true })

    res.redirect("/appointment")
})


app.post("/saveImage", upload.single('myFile'), async function (req, res) {

    const { folderName, diseaseName } = req.body

    let uuid = UUID();
    let downLoadPath = "https://firebasestorage.googleapis.com/v0/b/smart-agriot.appspot.com/o/";

    const profileImage = req.file;

    const fileName = folderName === 'userImg' ? profileImage.filename : (diseaseName + ":" + Date.now() + '.png')

    const bucket = firebaseStorage.bucket(process.env.BUCKET_URL);
    const imageResponse = await bucket.upload(profileImage.path, {
        destination: `${folderName}/${fileName}`,
        resumable: true,
        metadata: {
            metadata: {
                firebaseStorageDownloadTokens: uuid,
            },
        }
    })
    let imageUrl = downLoadPath + encodeURIComponent(imageResponse[0].name) + "?alt=media&token=" + uuid;

    const directory = "./tmp";
    fs.readdir(directory, (err, files) => {
        if (err) throw err;
        for (const file of files) {
            fs.unlink(path.join(directory, file), (err) => {
                if (err) throw err;
            });
        }
    });

    res.json({ imageUrl })
})


app.get("/abt", function (req, res) {
    res.render("about", { info: teamInfo })
})

app.listen(process.env.PORT || 3000, function () {
    console.log("Running on Port 3000")
})