/* eslint-disable no-unused-vars */
'use strict'

const { INTEGER } = require('sequelize')

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Todos', 'userId', {
      type: Sequelize.DataTypes.INTEGER,
    })
    await queryInterface.addConstraint('Todos', {
      fields: ['userId'],
      type: 'foreign key',
      References: {
        table: 'users',
        fields: 'id',
      },
    })
  },

  async down(queryInterface, Sequelize) {
    queryInterface.removeColumn('Todos', 'userId')
  },
}
