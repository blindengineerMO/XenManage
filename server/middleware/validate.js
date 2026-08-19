const Joi = require('joi');

function validate(schema, source = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], { abortEarly: false, stripUnknown: true });
    if (error) {
      return res.status(400).json({
        error: 'VALIDATION_ERROR',
        details: error.details.map(d => ({ field: d.path.join('.'), message: d.message })),
      });
    }
    req[source] = value;
    next();
  };
}

const schemas = {
  login: Joi.object({
    host: Joi.string().required().min(1).max(255),
    username: Joi.string().required().min(1).max(100),
    password: Joi.string().required().min(1).max(255),
  }),
  connectionId: Joi.object({
    id: Joi.number().integer().min(1).required(),
  }),
  connectionCreate: Joi.object({
    name: Joi.string().trim().required().min(1).max(120),
    host: Joi.string().trim().required().min(1).max(255),
    username: Joi.string().trim().required().min(1).max(100),
    port: Joi.number().integer().min(1).max(65535).default(443),
    isDefault: Joi.boolean().default(false),
  }),
  connectionUpdate: Joi.object({
    name: Joi.string().trim().required().min(1).max(120),
    host: Joi.string().trim().required().min(1).max(255),
    username: Joi.string().trim().required().min(1).max(100),
    port: Joi.number().integer().min(1).max(65535).default(443),
    isDefault: Joi.boolean().default(false),
  }),
  hostTargetCreate: Joi.object({
    name: Joi.string().trim().required().min(1).max(120),
    host: Joi.string().trim().required().min(1).max(255),
    username: Joi.string().trim().required().min(1).max(100),
    port: Joi.number().integer().min(1).max(65535).default(443),
    mode: Joi.string().valid('standalone', 'pool-member').default('standalone'),
    poolConnectionId: Joi.alternatives().conditional('mode', {
      is: 'pool-member',
      then: Joi.number().integer().min(1).required(),
      otherwise: Joi.allow(null).default(null),
    }),
    notes: Joi.string().allow('').max(500).default(''),
  }),
  hostTargetUpdate: Joi.object({
    name: Joi.string().trim().required().min(1).max(120),
    host: Joi.string().trim().required().min(1).max(255),
    username: Joi.string().trim().required().min(1).max(100),
    port: Joi.number().integer().min(1).max(65535).default(443),
    mode: Joi.string().valid('standalone', 'pool-member').default('standalone'),
    poolConnectionId: Joi.alternatives().conditional('mode', {
      is: 'pool-member',
      then: Joi.number().integer().min(1).required(),
      otherwise: Joi.allow(null).default(null),
    }),
    notes: Joi.string().allow('').max(500).default(''),
  }),
  vmAction: Joi.object({
    ref: Joi.string().required().pattern(/^OpaqueRef:/),
  }),
  vmLifecycle: Joi.object({
    ref: Joi.string().required().pattern(/^OpaqueRef:/),
    paused: Joi.boolean().default(false),
    force: Joi.boolean().default(false),
  }),
  paginate: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    pageSize: Joi.number().integer().min(1).max(500).default(50),
    search: Joi.string().allow('').default(''),
    sort: Joi.string().allow('').default(''),
    sortDir: Joi.string().valid('asc', 'desc').default('asc'),
  }),
};

module.exports = { validate, schemas };
