import * as express from 'express';
import { Either } from 'fp-ts/lib/Either';
import * as task from 'fp-ts/lib/Task';
import * as t from 'io-ts';

import { TaskEither } from './helpers/TaskEither';

type AsyncRequestHandler = (req: express.Request, res: express.Response) => Promise<void>;
type wrapAsyncRequestHandler = ((
    asyncRequestHandler: AsyncRequestHandler,
) => express.RequestHandler);
const wrapAsyncRequestHandler: wrapAsyncRequestHandler = promiseFn => (req, res, next) =>
    promiseFn(req, res).catch(next);

export const createValidatedRequestTypes = <Query, Session, Body>(
    types: ValidatedRequestTypes<Query, Session, Body>,
): ValidatedRequestTypes<Query, Session, Body> => types;
export type ValidatedRequestTypes<Query, Session, Body> = {
    query: t.Type<Query>;
    session: t.Type<Session>;
    body: t.Type<Body>;
};
type ValidatedRequest<Query, Session, Body> = {
    ip: string;
    query: Query;
    session: Session;
    body: Body;
};
type validateRequest = <Query, Session, Body, ErrorResponse>(
    args: {
        req: express.Request;
        types: ValidatedRequestTypes<Query, Session, Body>;
        createValidationErrorsError: (validationErrors: t.ValidationError[]) => ErrorResponse;
    },
) => Either<ErrorResponse, ValidatedRequest<Query, Session, Body>>;
const validateReq: validateRequest = ({ req, types, createValidationErrorsError }) =>
    t
        .validate(
            {
                query: req.query,
                session: req.session,
                body: req.body,
            },
            t.interface(
                {
                    query: types.query,
                    session: types.session,
                    body: types.body,
                },
                'request',
            ),
        )
        .mapLeft(createValidationErrorsError)
        .map(({ query, session, body }) => ({ ip: req.ip, query, session, body }));

export type ResponseHandler<Response> = ((
    req: express.Request,
    res: express.Response,
) => (response: Response) => void);

type ValidatedRequestHandler<Query, Session, Body, ErrorResponse, SuccessResponse> = ((
    validatedReq: ValidatedRequest<Query, Session, Body>,
) => Either<ErrorResponse, SuccessResponse>);
export type wrapValidatedRequestHandler = (<Query, Session, Body, ErrorResponse, SuccessResponse>(
    args: {
        types: ValidatedRequestTypes<Query, Session, Body>;
        handler: ValidatedRequestHandler<Query, Session, Body, ErrorResponse, SuccessResponse>;
        errorResponseHandler: ResponseHandler<ErrorResponse>;
        successResponseHandler: ResponseHandler<SuccessResponse>;
        createValidationErrorsError: (validationErrors: t.ValidationError[]) => ErrorResponse;
    },
) => express.RequestHandler);
export const wrapValidatedRequestHandler: wrapValidatedRequestHandler = ({
    types,
    errorResponseHandler,
    successResponseHandler,
    handler,
    createValidationErrorsError,
}) => (req, res) => {
    validateReq({ req, types, createValidationErrorsError })
        .chain(handler)
        .fold(errorResponseHandler(req, res), successResponseHandler(req, res));
};

type AsyncValidatedRequestHandler<Query, Session, Body, ErrorResponse, SuccessResponse> = ((
    validatedReq: ValidatedRequest<Query, Session, Body>,
) => TaskEither<ErrorResponse, SuccessResponse>);
export type wrapAsyncValidatedRequestHandler = (<
    Query,
    Session,
    Body,
    ErrorResponse,
    SuccessResponse
>(
    args: {
        types: ValidatedRequestTypes<Query, Session, Body>;
        handler: AsyncValidatedRequestHandler<Query, Session, Body, ErrorResponse, SuccessResponse>;
        errorResponseHandler: ResponseHandler<ErrorResponse>;
        successResponseHandler: ResponseHandler<SuccessResponse>;
        createValidationErrorsError: (validationErrors: t.ValidationError[]) => ErrorResponse;
    },
) => express.RequestHandler);
export const wrapAsyncValidatedRequestHandler: wrapAsyncValidatedRequestHandler = ({
    types,
    errorResponseHandler,
    successResponseHandler,
    handler,
    createValidationErrorsError,
}) =>
    wrapAsyncRequestHandler((req, res) =>
        new TaskEither(task.of(validateReq({ req, types, createValidationErrorsError })))
            .chain(handler)
            .fold(errorResponseHandler(req, res), successResponseHandler(req, res))
            .run(),
    );
