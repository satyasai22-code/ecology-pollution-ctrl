var express = require('express'),
    app = express(),
    firebase = require('firebase'),
    bodyParser = require('body-parser');
    fb = require('./models'),
    sanitizer = require('express-sanitizer'),
    db = fb.firestore(),
    storage = fb.storage(),
    realTimeDb = fb.database();


app.use(express.static(__dirname + "/public"));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(sanitizer());

function isAuthenticated(req, res, next) {
    var user = firebase.auth().currentUser;
    if (user !== null) {   
        req.user = user.providerData[0];
        next();
    } else {
        res.redirect('/userdetails');
    }
}

function isLoggedIn(req,res,next){
    var user = firebase.auth().currentUser;
    if (user !== null) {   
        req.user = user.providerData[0];
        next();
    } else {
        req.user=null;
        next();
    }
}

var Admins = db.collection('Admins');
var Adm_list;
setInterval(()=>{
    Admins.get()
    .then((data)=>{
        data.forEach((admin)=>{
            Adm_list=admin.data().list;
    });
})},5000);

app.use(isLoggedIn, function(req,res,next){
    res.locals.currentUser = req.user;
    if(req.user) res.locals.isWriter = (Adm_list.includes(req.user.uid))? true:false;
    next();
})


app.get('/', (req, res) => {
    res.render('index.ejs');
});


//create a collection of different pollution types in db and retrieve required data
var categories = {
    airPollution: db.collection('air-pollution'),
    waterPollution: db.collection('water-pollution'),
    plasticPollution: db.collection('plastic-pollution'),
    otherPollution: db.collection('other-pollution')
}

//category routes and logic to get specific data
app.get('/air-pollution', (req, res) => {
    categories['airPollution'].get()
        .then((data) => {
            var articles = [];
            data.forEach((article) => {
                var obj = { ...article.data(), id: article.id }
                articles.push(obj);
            });
            res.render('categories/index.ejs', { data: articles, category: 'Air Pollution', moreinfo: 'air-pollution' });
        })
        .catch((err) => {
            console.log(err);
            res.redirect('/');
        });
});

app.get('/water-pollution', (req, res) => {
    categories['waterPollution'].get()
        .then((data) => {
            var articles = [];
            data.forEach((article) => {
                var obj = { ...article.data(), id: article.id }
                articles.push(obj);
            });
            res.render('categories/index.ejs', { data: articles, category: 'Water Pollution', moreinfo: 'water-pollution' });
        })
        .catch((err) => {
            console.log(err);
            res.redirect('/');
        });
});

app.get('/plastic-pollution', (req, res) => {
    categories['plasticPollution'].get()
        .then((data) => {
            var articles = [];
            data.forEach((article) => {
                var obj = { ...article.data(), id: article.id }
                articles.push(obj);
            });
            res.render('categories/show-article.ejs', { data: articles, category: 'Plastic Pollution', moreinfo: 'plastic-pollution' });
        })
        .catch((err) => {
            console.log(err);
            res.redirect('/');
        });
});

app.get('/other-pollution', (req, res) => {
    categories['otherPollution'].get()
        .then((data) => {
            var articles = [];
            data.forEach((article) => {
                var obj = { ...article.data(), id: article.id }
                articles.push(obj);
            });
            res.render('categories/index.ejs', { data: articles, category: 'Other Pollution', moreinfo: 'other-pollution' });
        })
        .catch((err) => {
            console.log(err);
            res.redirect('/');
        });
});

app.get('/add-article', isAuthenticated, (req, res) => {
    if(Adm_list.includes(req.user.uid)){
        res.render('categories/add-article.ejs');
    }
    else{
        res.redirect('back');
    }
});

app.post('/add-article', isAuthenticated, (req, res) => {
    if(Adm_list.includes(req.user.uid)){
        var data = req.body;
        var category = categories[data.category];
        var img_url = "https://firebasestorage.googleapis.com/v0/b/pollutionctrl.appspot.com/o/article_imgs%2F" + req.body.img + "?alt=media"
        req.body.desp = req.sanitize(req.body.desp);
        category.add({
            name: req.user.displayName,
            article_name: data.name,
            desp: data.desp,
            img: img_url,
            _id: uid,
            Date: firebase.firestore.FieldValue.serverTimestamp()
        })
            .then(() => {
                //add flash msg: Added Article Successfull and redirect to index page
                res.status(200).redirect('back');
            })
    }
    else{
        res.redirect('back');
    }

});

app.get("/request-access", isAuthenticated, (req, res) => {
    //flash request sent
    var requests = db.collection('request');
    requests.add({
        _id: req.user.uid
    })
    .then
    res.redirect('back');
})


//features routes
app.get('/dashboard', (req, res) => {
    res.render('features/dashboard.ejs');
});

app.get('/news', (req, res) => {
    var allnews = [];
    var news = realTimeDb.ref('news_data');
    news.on('value', function (snapshot) {
        snapshot.forEach(function (childSnapshot) {
            allnews.push(childSnapshot.val());
        });
        res.render('features/news.ejs', { data: allnews });
    });
});

//user query routes
const userqueries = db.collection('UserQueries');

app.get('/queries', (req, res) => {
    userqueries.get()
        .then((data) => {
            var list = [];
            data.forEach((query) => {
                var data = {
                    data: query.data(),
                    uid: query.id
                }
                list.push(data);
            });
            res.render("features/userqueries.ejs", {data:list});
        })
        .catch((err) => {
            console.log(err);
            res.redirect('back');
        });
});


app.post('/queries', isAuthenticated, (req, res) => {
        var data = req.body;
        userqueries.add({
            name: req.user.displayName,
            msg: data.msg,
            comments: [],
            Date: firebase.firestore.FieldValue.serverTimestamp()
        })
        .then(() => {
            //add flash msg: Added Article Successfull and redirect to index page
            res.status(200).redirect('back');
        })
});

app.post('/queries/:id', isAuthenticated, (req,res)=>{
    var query = userqueries.doc(req.params.id);
    query.get().then((doc)=>{
        var comments = doc.data().comments;
        comments.push(req.body.comment);
        query.set({
            comments : comments
        }, { merge: true });
    })
    .then(()=>{
        res.redirect('back');
    })

});

app.get('/mystats', isAuthenticated, (req,res)=>{
    res.render('features/mystats.ejs');
});

app.get('/carbonfootprint', isAuthenticated, (req, res)=>{
    var allquestions = [];
    var questions = realTimeDb.ref('cf_ques');
    questions.on('value', function (snapshot) {
        snapshot.forEach(function (childSnapshot) {
            allquestions.push(childSnapshot.val());
        });
        res.render('features/carbon-footprint.ejs', { data: allquestions });
    });
});

app.post('/carbonfootprint', isAuthenticated, (req,res)=>{
    res.redirect('/mystats');
});

//user signup and signin
app.get('/userdetails', (req, res) => {
    res.render('users/login_signup.ejs')
});

app.post('/signin', (req, res) => {
    firebase.auth().signInWithEmailAndPassword(req.body.email, req.body.password)
        .then(() => {
            res.redirect('/');
        })
        .catch(function (error) {
            console.log(error.code, error.message);
            res.redirect('/userdetails');
        });

});

app.post('/signup', (req, res) => {
    username = req.body.username;
    img = req.params.photoUrl || "https://bit.ly/2NQJoLr";
    firebase.auth().createUserWithEmailAndPassword(req.body.email, req.body.password)
        .then(() => {
            var user = firebase.auth().currentUser;
            user.updateProfile({
                displayName: req.body.username,
                photoURL: req.body.photoUrl
            })
                .then(() => {
                    res.redirect('/');
                })
                .catch((error) => {
                    console.log(error);
                    res.redirect('/userdetails');
                })
        })
        .catch(function (error) {
            console.log(error.code, error.message);
            res.redirect('back');
        });
});

app.get('/logout', isAuthenticated, (req, res) => {
    firebase.auth().signOut()
        .then(function () {
            // Sign-out successful.
            console.log('logged Out');
            res.redirect('back');
        })
        .catch(function (error) {
            // An error happened
            console.log(error);
            res.redirect('back');
        });
});


var cat = ""
//show route for articles kept at last due to :
app.get('/:category/:id', (req, res) => {
    cat = req.params.category;
    res.redirect('/' + req.params.id);
});

app.get("/:id", (req, res) => {
    var docRef = db.collection(cat).doc(req.params.id);

    docRef.get().then(function (doc) {
        if (doc.exists) {
            res.render('categories/show-article.ejs', { data: doc.data(), category: req.params.category })
        } else {
            // doc.data() will be undefined in this case
            console.log("No such document!");
            res.redirect('back');
        }
    }).catch(function (error) {
        console.log("Error getting document:", error);
        res.redirect('back');
    });
})

app.listen(8081, () => {
    console.log('Server is Running');
})