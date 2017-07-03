import * as bodyParser from 'body-parser';
import * as express from 'express';
import * as session from 'express-session';
import * as either from 'fp-ts/lib/Either';
import * as http from 'http';
import * as t from 'io-ts';

import { Either } from 'fp-ts/lib/Either';
import {
    composeTypes,
    formatValidationErrors,
    JSONFromString,
    NumberFromString,
} from './helpers/other';
import { createValidatedRequestTypes, wrapValidatedRequestHandler } from './index';

const app = express();
app.use(session({ secret: 'foo' }));
// We parse JSON using io-ts.
app.use(bodyParser.text({ type: 'application/json' }));

const requestTypes = createValidatedRequestTypes({
    session: t.interface({}),
    body: composeTypes(
        JSONFromString,
        t.interface({
            name: t.string,
        }),
        'Body',
    ),
    query: t.interface({
        age: NumberFromString,
    }),
});

type ErrorResponse = string[];
type SuccessResponse = { result: string };

const requestHandler = wrapValidatedRequestHandler({
    // These values will be validated against their types. These also serve as static types for
    // compile time type checking and auto completion.
    types: requestTypes,
    // If there is an error when validating the request, this maps it to our error type.
    createValidationErrorsError: formatValidationErrors,

    // After validation, we can use the validated request (session, body, query) to compute our
    // response.
    handler: (validatedReq): Either<ErrorResponse, SuccessResponse> =>
        // Here the type checker knows the type of our request’s session, body, and query objects.
        // E.g. `body.name` is type `string` and `query.age` is type `number`.
        either.right({ result: `name: ${validatedReq.body.name}, age: ${validatedReq.query.age}` }),

    // Once we've computed our response, we can inform Express so it can respond to the request.
    // In the future these could be incorporated into the return type of the `handler` function.
    errorResponseHandler: (_req, res) => (errorResponse: ErrorResponse) => {
        res.status(500).send(errorResponse);
    },
    successResponseHandler: (_req, res) => (successResponse: SuccessResponse) => {
        res.status(200).send(successResponse);
    },
});

app.post('/', requestHandler);
// app.post('/', (req, res) => {
//     console.log(req.body);
//     res.send(200)
// });

const onListen = (server: http.Server) => {
    const { port } = server.address();

    console.log(`Server running on port ${port}`);
};

const httpServer = http.createServer(app);
httpServer.listen(8080, () => {
    onListen(httpServer);
});

// ❯ curl --request POST --silent "localhost:8080/" | jq '.'
// [
//   "Expecting NumberFromString at query.age but instead got: undefined.",
//   "Expecting Body at body but instead got: {}."
// ]

// ❯ curl --request POST --silent --header 'Content-Type: application/json' \
//     --data '{ "name": "bob" }' "localhost:8080/?age=foo" | jq '.'
// [
//   "Expecting NumberFromString at query.age but instead got: \"foo\"."
// ]

// ❯ curl --request POST --silent --header 'Content-Type: application/json' \
//     --data '{ "name": "bob" }' "localhost:8080/?age=5" | jq '.'
// {
//   "result": "name: bob, age: 5"
// }
