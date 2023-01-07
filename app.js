const express = require('express')
const app = express()
var csrf = require('tiny-csrf')
var cookieParser = require('cookie-parser')
const { Todo, User } = require('./models')
const bodyParser = require('body-parser')
const path = require('path')
const bcrypt = require('bcrypt')
const passport = require('passport')
const connectEnsureLogin = require('connect-ensure-login')
const session = require('express-session')
const flash = require('connect-flash')
const LocalStratergy = require('passport-local')

const saltRounds = 10

// eslint-disable-next-line no-undef
app.set('views', path.join(__dirname, 'views'))
app.use(flash())
app.use(bodyParser.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser('Some secret string'))
app.use(csrf('this_should_be_32_character_long', ['POST', 'PUT', 'DELETE']))

app.use(
  session({
    secret: 'my-super-secret-key-2837428907583420',
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
    },
  }),
)

app.use(function (request, response, next) {
  response.locals.messages = request.flash()
  next()
})

app.use(passport.initialize())
app.use(passport.session())

passport.use(
  new LocalStratergy(
    {
      usernameField: 'email',
      passwordField: 'password',
    },
    (username, password, done) => {
      User.findOne({ where: { email: username } })
        .then(async (user) => {
          const result = await bcrypt.compare(password, user.password)
          if (result) {
            return done(null, user)
          } else {
            return done(null, false, { message: 'Invalid password' })
          }
        })
        .catch(() => {
          return done(null, false, { message: 'Invalid Email-ID' })
        })
    },
  ),
)

passport.serializeUser((user, done) => {
  console.log('Serializing user in session', user.id)
  done(null, user.id)
})

passport.deserializeUser((id, done) => {
  User.findByPk(id)
    .then((user) => {
      done(null, user)
    })
    .catch((error) => {
      done(error, null)
    })
})

app.set('view engine', 'ejs')
// eslint-disable-next-line no-undef
app.use(express.static(path.join(__dirname, 'public')))

app.get('/', async function (request, response) {
  response.render('index', {
    title: 'To-Do Manager',
    csrfToken: request.csrfToken(),
  })
})

app.get('/todos', connectEnsureLogin.ensureLoggedIn(), async function (
  request,
  response,
) {
  try {
    const loggedIn = request.user.id
    const overDue = await Todo.overDue(loggedIn)
    const dueToday = await Todo.dueToday(loggedIn)
    const dueLater = await Todo.dueLater(loggedIn)
    const completedItems = await Todo.completedItems(loggedIn)
    if (request.accepts('html')) {
      response.render('todos', {
        title: 'To-Do Manager',
        overDue,
        dueToday,
        dueLater,
        completedItems,
        csrfToken: request.csrfToken(),
      })
    } else {
      response.json({
        overDue,
        dueToday,
        dueLater,
        completedItems,
      })
    }
  } catch (err) {
    console.log(err)
    return response.status(422).json(err)
  }
})

app.get('/signup', (request, response) => {
  response.render('signup', {
    title: 'Sign up',
    csrfToken: request.csrfToken(),
  })
})

app.post('/users', async (request, response) => {
  if (!request.body.firstName) {
    request.flash('error', 'Please enter your first name')
    return response.redirect('/signup')
  }
  if (!request.body.email) {
    request.flash('error', 'Please enter email ID')
    return response.redirect('/signup')
  }
  if (!request.body.password) {
    request.flash('error', 'Please enter your password')
    return response.redirect('/signup')
  }
  if (request.body.password < 8) {
    request.flash('error', 'Password length should be atleast 8')
    return response.redirect('/signup')
  }
  const hashedPwd = await bcrypt.hash(request.body.password, saltRounds)
  try {
    const user = await User.create({
      firstName: request.body.firstName,
      lastName: request.body.lastName,
      email: request.body.email,
      password: hashedPwd,
    })
    request.login(user, (err) => {
      if (err) {
        console.log(err)
        response.redirect('/')
      } else {
        response.redirect('/todos')
      }
    })
  } catch (error) {
    request.flash('error', error.message)
    return response.redirect('/signup')
  }
})

app.get('/login', (request, response) => {
  response.render('login', {
    title: 'Login',
    csrfToken: request.csrfToken(),
  })
})

app.post(
  '/session',
  passport.authenticate('local', {
    failureRedirect: '/login',
    failureFlash: true,
  }),
  (request, response) => {
    response.redirect('/todos')
  },
)

app.get('/signout', (request, response, next) => {
  request.logout((err) => {
    if (err) {
      return next(err)
    }
    response.redirect('/')
  })
})

app.get('/todos/:id', connectEnsureLogin.ensureLoggedIn(), async function (
  request,
  response,
) {
  try {
    const todo = await Todo.findByPk(request.params.id)
    return response.json(todo)
  } catch (error) {
    console.log(error)
    return response.status(422).json(error)
  }
})

app.post('/todos', connectEnsureLogin.ensureLoggedIn(), async function (
  request,
  response,
) {
  if (request.body.title.length < 5) {
    request.flash('error', 'Title length should be atleast 5')
    return response.redirect('/todos')
  }
  if (!request.body.dueDate) {
    request.flash('error', 'Please select a due date')
    return response.redirect('/todos')
  }
  try {
    await Todo.addTodo({
      title: request.body.title,
      dueDate: request.body.dueDate,
      userID: request.user.id,
    })
    return response.redirect('/todos')
  } catch (error) {
    console.log(error)
    return response.status(422).json(error)
  }
})

app.put('/todos/:id', connectEnsureLogin.ensureLoggedIn(), async function (
  request,
  response,
) {
  const todo = await Todo.findByPk(request.params.id)
  try {
    const updatedTodo = await todo.setCompletionStatus(request.body.completed)
    return response.json(updatedTodo)
  } catch (error) {
    console.log(error)
    return response.status(422).json(error)
  }
})

app.delete('/todos/:id', connectEnsureLogin.ensureLoggedIn(), async function (
  request,
  response,
) {
  console.log('We have to delete a Todo with ID: ', request.params.id)

  try {
    const res = await Todo.remove(request.params.id, request.user.id)
    return response.json({ success: res === 1 })
  } catch (error) {
    console.log(error)
    return response.status(422).json(error)
  }
})

module.exports = app
