import * as express from 'express';
import * as session from 'express-session';
import * as either from 'fp-ts/lib/Either';
import * as task from 'fp-ts/lib/Task';
import * as http from 'http';
import * as t from 'io-ts';

import { formatValidationErrors, NumberFromString } from './helpers/other';
import { TaskEither } from './helpers/TaskEither';
import { createValidatedRequestTypes, wrapAsyncValidatedRequestHandler } from './index';

const app = express();
app.use(session({ secret: 'foo' }));

const requestTypes = createValidatedRequestTypes({
    session: t.interface({}),
    body: t.undefined,
    query: t.interface({
        count: NumberFromString,
    }),
});

const requestHandler = wrapAsyncValidatedRequestHandler({
    // These values will be validated against their types. These also serve as static types for
    // compile time type checking and auto completion.
    types: requestTypes,
    // If there is an error when validating the request, this maps it to our error type.
    createValidationErrorsError: formatValidationErrors,

    // After validation, we can use the validated request (session, body, query) to compute our
    // response.
    handler: (validatedReq): TaskEither<string[], number> =>
        // Here the type checker knows that `query.count` is type `number`
        new TaskEither(task.of(either.right(validatedReq.query.count + 1))),

    // Once we've computed our response, we can inform Express so it can respond to the request.
    // In the future these could be incorporated into the return type of the `handler` function.
    errorResponseHandler: (_req, res) => (errorResponse: string[]) => {
        res.status(500).send(errorResponse);
    },
    successResponseHandler: (_req, res) => (successResponse: number) => {
        const body = successResponse.toString();
        res.status(200).send(body);
    },
});

app.get('/', requestHandler);

const onListen = (server: http.Server) => {
    const { port } = server.address();

    console.log(`Server running on port ${port}`);
};

const httpServer = http.createServer(app);
httpServer.listen(8080, () => {
    onListen(httpServer);
});

// ❯ curl -s "localhost:8080/"
// ["Expecting NumberFromString at query.count but instead got: undefined."]

// ❯ curl -s "localhost:8080/?count=foo"
// ["Expecting NumberFromString at query.count but instead got: \"foo\"."]

// ❯ curl -s "localhost:8080/?count=1"
// 2
