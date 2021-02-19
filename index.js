const express = require('express')
const app = express()
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser")
const session = require('express-session')
const expressLayouts = require('express-ejs-layouts')
const Entry = require('./models/Entry')
const mongoose = require('mongoose')
const md = require('markdown-it')();

// Connect to mongoose
const url = 'mongodb://localhost:27017'; // Local DataBase URL
const dbName = 'Wiki' // DataBase Name
mongoose.connect(`${url}/${dbName}`, { useNewUrlParser: true, useUnifiedTopology: true })

// Static Files
app.use(express.static('public'))
app.use('/public', express.static('public'))
app.use('/css', express.static(__dirname + 'public/css'))
app.use('/js', express.static(__dirname + 'public/js'))
app.use('/img', express.static(__dirname + 'public/img'))

// Setting View Engine and it's related stuff
app.set('view engine', 'ejs');
app.use(expressLayouts);

//Here we are configuring express to use body-parser as middle-ware.
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Configuring Cookie Parser as a middle-ware
app.use(cookieParser('secret'))

// Configuring sessions
app.use(session({ cookie: { maxAge: null } }))

// Flash message middle-ware
app.use((req, res, next) => {
    res.locals.message = req.session.message
    delete req.session.message
    next()
})

// Search Results middle-ware
app.use((req, res, next) => {
    res.locals.searchResults = req.session.searchResults
    delete req.session.searchResults
    next()
})

// Navigation
app.get('/home', (req, res) => {
    res.redirect('/');
})

app.get('/', async (req, res) => {
    const entries = await Entry.find({})
    res.render('index', { 'wikis': entries, pagetitle: 'Home' })
});

app.get('/new', (req, res) => {
    res.render('new_entry', { pagetitle: 'New Wiki' })
});

app.post('/new', async (req, res) => {
    if (req.body.title.trim() == '' || req.body.content.trim() == '') {
        req.session.message = {
            type: 'danger',
            intro: 'Empty fields! ',
            message: 'Please enter the requested information'
        }
        return res.redirect('/new')
    } else if (req.body.title.trim().length > 20) {
        req.session.message = {
            type: 'danger',
            intro: 'Title too long! ',
            message: 'Please make sure the title is below 20 characters...'
        }
        return res.redirect('/new')
    } else if (await Entry.findOne({ title: req.body.title })) {
        req.session.message = {
            type: 'danger',
            intro: 'That title already exists! ',
            message: 'Please choose a different title for the wiki.'
        }
        return res.redirect('/new')
    } else {
        Entry.create({
            _id: new mongoose.Types.ObjectId(),
            url: req.body.title.toLocaleLowerCase().trim().split(" ").join("-"),
            title: req.body.title.trim(),
            content: req.body.content
        })
        req.session.message = {
            type: 'success',
            intro: 'Added wiki successfully! ',
            message: 'Your wiki has been successfully added to our database.'
        }
        return res.redirect('/')
    }
})

app.get('/wiki/:url/edit', async (req, res) => {
    const entry = await Entry.findOne({ url: req.params.url })
    if (!entry) {
        req.session.message = {
            type: 'danger',
            intro: `Cannot edit ${req.params.url}. `,
            message: `We could not find ${req.params.url}, so it is not possible to edit it.`
        }
        return res.redirect('/')
    }
    res.render('edit_entry', { pagetitle: 'Edit Wiki', titleInput: entry.title, urlInput: entry.url, contentTextArea: entry.content })
})

app.post('/wiki/:url/edit', async (req, res) => {
    if (req.body.title.trim() == '' || req.body.content.trim() == '') {
        req.session.message = {
            type: 'danger',
            intro: 'Empty fields! ',
            message: 'Please enter the requested information'
        }
        return res.redirect(`/wiki/${req.params.url}/edit`)
    } else if (req.body.title.trim().length > 20) {
        req.session.message = {
            type: 'danger',
            intro: 'Title too long! ',
            message: 'Please make sure the title is below 20 characters...'
        }
        return res.redirect(`/wiki/${req.params.url}/edit`)
    }
    await Entry.updateOne({ url: req.params.url }, {
        url: req.body.title.toLocaleLowerCase().trim().split(" ").join("-"),
        title: req.body.title.trim(),
        content: req.body.content
    })
    req.session.message = {
        type: 'success',
        intro: `Successfully edited ${req.body.title}. `,
        message: `We have successfully edited wiki  our database. `
    }
    return res.redirect('/')
})

app.get('/wiki/:url', async (req, res) => {
    const entry = await Entry.findOne({ url: req.params.url.toLocaleLowerCase() })
    if (!entry) {
        req.session.message = {
            type: 'danger',
            intro: `Cannot find  ${req.params.url}. `,
            message: 'Be the first one to create it!'
        }
        return res.redirect('/')
    }
    res.render('entry', { content: md.render(entry.content), pagetitle: entry.title })
})

app.get('/wiki/:url/delete', async (req, res) => {
    const entry = await Entry.findOne({ url: req.params.url })
    if (!entry) {
        req.session.message = {
            type: 'danger',
            intro: `Cannot delete ${req.params.url}. `,
            message: `We could not find ${req.params.url}, so it is not possible to delete it.`
        }
        return res.redirect('/')
    } else {
        entry.delete()
        req.session.message = {
            type: 'success',
            intro: `Successfully deleted ${req.params.url}. `,
            message: `We have successfully removed wiki from our database. `
        }
        return res.redirect('/')
    }
})

app.get('/random', async (req, res) => {
    const entries = await Entry.find({})
    const randomEntry = entries[Math.floor(Math.random() * entries.length)];
    res.redirect(`/wiki/${randomEntry.url}`)
})

app.get('/search-results', (req, res) => {
    res.render('search-results', { pagetitle: 'Search Results' })
})

app.post('/search', async (req, res) => {
    const entry = await Entry.find({ title: req.body.wiki_search })
    if (entry[0]) {
        return res.redirect(`/wiki/${entry[0].url}`)
    } else {
        let entries = await Entry.find({})
        entries = entries.filter(entry => entry.title.toLocaleLowerCase().includes(req.body.wiki_search))
        req.session.searchResults = { wikis: entries, queryString: req.body.wiki_search }
        return res.redirect('/search-results')
    }
})

// 404 Error Route
app.get('*', function (req, res) {
    res.status(404)
    res.send('<title>Not Found  </title><h1>Not Found</h1><h2>Error 404</h2>')
});

// Listen on PORT
port = process.env.PORT || 3000
app.listen(port, console.log(`Running on port ${port}`));