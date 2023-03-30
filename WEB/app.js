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
const FieldValue = admin.firestore.FieldValue;
const firebaseStorage = new Storage({
    keyFilename: "config.json",
});
  

const precisionPage = require('./data/precision.json')
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
    res.render("home", {   isLoggedIn, role })
})

app.get("/qgisPage", sessionCheckerFarmer, function (req, res) {
    res.render("qgisTracking")
})

app.get("/CropPrediction", sessionCheckerFarmer, function (req, res) {
    res.render("farmer/CropPrediction", { result: [] })
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
    result = [res1, res2, res3]
    res.render("farmer/CropPrediction", { result })
})

app.get("/PrecisionAgriculture", sessionCheckerFarmer, function (req, res) {
    res.render("farmer/precisionAgri", { data: precisionPage, links: {} })
})

app.post("/PrecisionAgriculture", function (req, res) {
    res.render("farmer/precisionAgri", { data: precisionPage, links: precisionPage[req.body.crop] })
})

app.get("/SmartFarming", sessionCheckerFarmer, async function (req, res) {

    session = req.session;
    const userID = session.userid

    const farmRef = db.collection('Farm').doc(userID);
    const farmInfo = await farmRef.get()
    if (!farmInfo.exists) {
        res.send("Error 404 : NO USER FOUND")
        return
    }
    farm = farmInfo.data()

    allCrops = ['Apple', 'Banana', 'Blackgram', 'Chickpea', 'Coconut', 'Coffee',
        'Cotton', 'Grapes', 'Jute', 'Kidneybeans', 'Lentil', 'Maize',
        'Mango', 'Mothbeans', 'Mungbean', 'Muskmelon', 'Orange', 'Papaya',
        'Pigeonpeas', 'Pomegranate', 'Rice', 'Watermelon']

    const farmSize = farm.nosOf_ESPs * 16
    let cropsInFarm = new Array(farmSize).fill(0);
    for (let i = 0; i < farmSize; i++) {
        if (farm["P" + i]) {
            cropsInFarm[i] = farm["P" + i]
        }
    }

    res.render("farmer/smartFarm", { cropsInFarm, userID, allCrops, mode: farm.mode, currentPlant: farm.CURR_WATER })
})

app.get("/listenRealTime", sessionCheckerFarmer, async function (req, res) {

    session = req.session;
    const userID = session.userid

    const farmQuesy = await db.collection('Farm').doc(userID).get()
    let data = farmQuesy.data()
    const size = data.nosOf_ESPs * 16
    let status = []
    for (let i = 0; i < size; i++) {
        data[`P${i}`] && status.push(data[`P${i}`].MOIS_STATUS)
    }

    res.status(200)
    res.json({ MOIST_STATUS: status, CURR_WATER: data.CURR_WATER })

})

app.post("/changeModeMotor", sessionCheckerFarmer, async function (req, res) {

    session = req.session;
    const userID = session.userid
    const { mode: newMode, currWater, status } = req.body

    const farmRef = db.collection('Farm').doc(userID)

    let obj = {}
    obj.mode = newMode
    obj.CURR_WATER = newMode == "0" || status == false ? -1 : currWater

    const updateFarm = await farmRef.update(obj, { merge: true });

    res.status(200)
    res.json({ UPDATED: "GOOD" })

})

app.get("/login", sessionChecker, function (req, res) {
    session = req.session
    if (session.role == 'farmer') res.redirect(301, "/qgisPage")
    else if (session.role == 'expert') res.redirect(301, "/appointment")
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
    res.render("farmer/weather", { weather: "Weather", info: "", api: process.env.WEATHERAPI })
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

    res.render("farmer/weather", { weather: "Weather", info: content.val, url: url, api: process.env.WEATHERAPI })
})

app.get("/currCityConditions/:cty", async function (req, res) {
    const val = req.params.cty
    const resp = await fetch(`https://api.weatherapi.com/v1/current.json?key=${process.env.WEATHERAPI}&q=${val}&aqi=no`)
    const data = await resp.json();
    res.json(data)
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

    res.render("farmer/diseaseDetect", { alreadyRaised, prev })
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
    user.userID = userID
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
        const imgURL = query.data().image;
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


app.get("/farmSetup/:userID", sessionCheckerExpert, async function (req, res) {

    const userID = req.params.userID

    const farmRef = db.collection('Farm').doc(userID);
    const farmInfo = await farmRef.get()
    if (!farmInfo.exists) {
        res.send("Error 404 : NO USER FOUND")
        return
    }
    farm = farmInfo.data()

    allCrops = ['Apple', 'Banana', 'Blackgram', 'Chickpea', 'Coconut', 'Coffee',
        'Cotton', 'Grapes', 'Jute', 'Kidneybeans', 'Lentil', 'Maize',
        'Mango', 'Mothbeans', 'Mungbean', 'Muskmelon', 'Orange', 'Papaya',
        'Pigeonpeas', 'Pomegranate', 'Rice', 'Watermelon']

    const farmSize = farm.nosOf_ESPs * 16
    let cropsInFarm = new Array(farmSize).fill(0);
    for (let i = 0; i < farmSize; i++) {
        if (farm["P" + i]) {
            cropsInFarm[i] = farm["P" + i]
        }
    }

    res.render("expert/farmSetup", { cropsInFarm, userID, allCrops })
})

app.post("/updateFarmNPK/:userID", sessionCheckerExpert, async function (req, res) {

    const { sectionID, name: cropName, nitro, phosp, potas } = req.body
    const userID = req.params.userID

    var key = sectionID;
    var obj = {};

    obj[key] = {
        name: cropName,
        n: parseInt(nitro),
        p: parseInt(phosp),
        k: parseInt(potas)
    };

    const farmRef = await db.collection('Farm').doc(userID).set(obj, { merge: true });

    res.json({ message: "REQUEST RECEIVED" })
})

app.post("/addFarmSection/:userID", sessionCheckerExpert, async function (req, res) {

    var { crop, name, n, p, k, capacity } = req.body
    const userID = req.params.userID

    const farmRef = db.collection('Farm').doc(userID)
    const farm = await farmRef.get()
    const farmInfo = farm.data()

    if (farmInfo.availableSection <= 0) {
        res.status(507);
        res.json({ message: 'Insufficient Pins' });
        return
    }

    const totalArea = farmInfo.nosOf_ESPs * 16
    let sectionID = "P"
    for (let i = 0; i < totalArea; i++) {
        if (!farmInfo[`P${i}`]) {
            sectionID = `P${i}`
            break
        }
    }
    var cropType = crop;
    var key = sectionID;
    var obj = {};
    let totalCapacity = farmInfo[cropType] ? (parseInt(farmInfo[cropType].capacity) + parseInt(capacity)) : parseInt(capacity)
    const d = new Date();
    obj[key] = {
        crop: crop,
        name: name,
        n: parseInt(n),
        p: parseInt(p),
        k: parseInt(k),
        MOIS_STATUS: 0,
        date: `${d.getMonth() + 1}-${d.getFullYear()}`,
        capacity: parseInt(capacity)
    };

    obj[cropType] = {
        capacity: totalCapacity
    };
    obj.availableSection = farmInfo.availableSection - 1
    const updateFarm = await farmRef.set(obj, { merge: true });

    res.status(201);
    res.json({ message: 'Updated' });
})


app.post("/deleteFarmSection/:userID", sessionCheckerExpert, async function (req, res) {

    const userID = req.params.userID
    const { sectionID } = req.body

    const farmRef = db.collection('Farm').doc(userID)
    const farm = await farmRef.get()
    const farmInfo = farm.data()

    let { crop, capacity } = farmInfo[sectionID]
    var key = sectionID;

    //available section update  
    var obj = {
        availableSection: FieldValue.increment(1)
    };

    // capacity update
    if (farmInfo[crop].capacity - capacity <= 0) {
        obj[crop] = FieldValue.delete()
    } else {
        obj[crop] = {
            capacity: farmInfo[crop].capacity - capacity
        };
    }

    // delet section
    obj[key] = FieldValue.delete()

    const updateFarm = await farmRef.update(obj, { merge: true });

    res.status(201);
    res.json({ message: 'Updated' });
})

app.get("/abt", function (req, res) {
    res.render("about", { info: teamInfo })
})

app.listen(process.env.PORT || 3000, function () {
    console.log("Running on Port 3000")
})