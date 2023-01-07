/* eslint-disable no-undef */
const request = require('supertest')
const cheerio = require('cheerio')
const db = require('../models/index')
const app = require('../app')

let server, agent

function extractCsrfToken(res) {
  var $ = cheerio.load(res.text)
  return $('[name=_csrf]').val()
}

const login = async (agent, username, password) => {
  let res = await agent.get('/login')
  let csrfToken = extractCsrfToken(res)
  res = await agent.post('/session').send({
    email: username,
    password: password,
    _csrf: csrfToken,
  })
}

describe('Todo Application', function () {
  beforeAll(async () => {
    await db.sequelize.sync({ force: true })
    server = app.listen(4000, () => {})
    agent = request.agent(server)
  })

  afterAll(async () => {
    try {
      await db.sequelize.close()
      await server.close()
    } catch (error) {
      console.log(error)
    }
  })

  test('Sign up', async () => {
    let res = await agent.get('/signup')
    const csrfToken = extractCsrfToken(res)
    res = await agent.post('/users').send({
      firstName: 'Test',
      lastName: 'User A',
      email: 'user.a@test.com',
      password: '12345678',
      _csrf: csrfToken,
    })
    expect(res.statusCode).toBe(302)
  })

  test('Sign out', async () => {
    let res = await agent.get('/todos')
    expect(res.statusCode).toBe(200)
    res = await agent.get('/signout')
    expect(res.statusCode).toBe(302)
    res = await agent.get('/todos')
    expect(res.statusCode).toBe(302)
  })

  test('Creates a todo and responds with json at /todos POST endpoint', async () => {
    const agent = request.agent(server)
    await login(agent, 'user.a@test.com', '12345678')
    const res = await agent.get('/todos')
    const csrfToken = extractCsrfToken(res)
    const response = await agent.post('/todos').send({
      title: 'Buy milk',
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: csrfToken,
    })
    expect(response.statusCode).toBe(302)
  })

  test('Marks a todo with the given ID as complete', async () => {
    const agent = request.agent(server)
    await login(agent, 'user.a@test.com', '12345678')
    let res = await agent.get('/todos')
    let csrfToken = extractCsrfToken(res)
    await agent.post('/todos').send({
      title: 'Buy milk',
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: csrfToken,
    })

    const groupedTodosResponse = await agent
      .get('/todos')
      .set('Accept', 'application/json')
    const parsedGroupedResponse = JSON.parse(groupedTodosResponse.text)
    const dueTodayCount = parsedGroupedResponse.dueToday.length
    const latestTodo = parsedGroupedResponse.dueToday[dueTodayCount - 1]

    res = await agent.get('/todos')
    csrfToken = extractCsrfToken(res)

    const markCompleteResponse = await agent
      .put(`/todos/${latestTodo.id}`)
      .send({
        _csrf: csrfToken,
        completed: true,
      })
    const parsedUpdateResponse = JSON.parse(markCompleteResponse.text)
    expect(parsedUpdateResponse.completed).toBe(true)
  })

  test('Marks a todo with the given ID as incomplete', async () => {
    const agent = request.agent(server)
    await login(agent, 'user.a@test.com', '12345678')
    let res = await agent.get('/todos')
    let csrfToken = extractCsrfToken(res)
    await agent.post('/todos').send({
      title: 'Buy chips',
      dueDate: new Date().toISOString(),
      completed: true,
      _csrf: csrfToken,
    })

    const groupedTodosResponse = await agent
      .get('/todos')
      .set('Accept', 'application/json')
    const parsedGroupedResponse = JSON.parse(groupedTodosResponse.text)
    const dueTodayCount = parsedGroupedResponse.dueToday.length
    const latestTodo = parsedGroupedResponse.dueToday[dueTodayCount - 1]

    res = await agent.get('/todos')
    csrfToken = extractCsrfToken(res)

    const markCompleteResponse = await agent
      .put(`/todos/${latestTodo.id}`)
      .send({
        _csrf: csrfToken,
        completed: false,
      })
    const parsedUpdateResponse = JSON.parse(markCompleteResponse.text)
    expect(parsedUpdateResponse.completed).toBe(false)
  })

  test('Deletes a todo with the given ID if it exists and sends a boolean response', async () => {
    const agent = request.agent(server)
    await login(agent, 'user.a@test.com', '12345678')
    let res = await agent.get('/todos')
    let csrfToken = extractCsrfToken(res)
    await agent.post('/todos').send({
      title: 'Buy milk',
      dueDate: new Date().toISOString(),
      completed: false,
      _csrf: csrfToken,
    })

    const groupedTodosResponse = await agent
      .get('/todos')
      .set('Accept', 'application/json')

    const parsedGroupedResponse = JSON.parse(groupedTodosResponse.text)
    const dueTodayCount = parsedGroupedResponse.dueToday.length
    const latestTodo = parsedGroupedResponse.dueToday[dueTodayCount - 1]

    res = await agent.get('/todos')
    csrfToken = extractCsrfToken(res)
    //testing for response-true
    const todoID = latestTodo.id
    const deleteResponse = await agent.delete(`/todos/${todoID}`).send({
      _csrf: csrfToken,
    })
    const parsedDeleteResponse = JSON.parse(deleteResponse.text).success
    expect(parsedDeleteResponse).toBe(true)
    //testing for response-false
    //as above id is deleted it does not exist
    res = await agent.get('/todos')
    csrfToken = extractCsrfToken(res)

    const deleteResponse2 = await agent.delete(`/todos/${todoID}`).send({
      _csrf: csrfToken,
    })
    const parsedDeleteResponse2 = JSON.parse(deleteResponse2.text).success
    expect(parsedDeleteResponse2).toBe(false)
  })
})
