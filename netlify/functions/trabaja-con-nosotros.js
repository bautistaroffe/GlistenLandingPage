'use strict';

const { handleFormSubmission } = require('./_shared');

exports.handler = async (event) => handleFormSubmission(event, 'job');
