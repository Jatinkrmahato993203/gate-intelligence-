import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

type ValidationSource = 'body' | 'query' | 'params';

export const validate = (schema: Joi.ObjectSchema, source: ValidationSource = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true, // Remove unknown fields
    });

    if (error) {
      const errorMessage = error.details.map((details) => details.message).join(', ');
      res.status(400).json({ error: errorMessage });
      return;
    }

    // Replace the original req object with the validated and stripped object
    req[source] = value;
    next();
  };
};
