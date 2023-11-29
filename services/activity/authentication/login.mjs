import {
  AdminGetUserCommand,
  InitiateAuthCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";

// Initialize the Cognito client
const client = new CognitoIdentityProviderClient({});

// Get the sign-in token
// const accessToken = authFlow.AuthenticationResult.AccessToken;

// const adminGetUser = ({ userPoolId, username }) => {

//   const command = new AdminGetUserCommand({
//     UserPoolId: userPoolId,
//     Username: username,
//   });

//   return client.send(command);
// };
/** snippet-end:[javascript.v3.cognito-idp.actions.AdminGetUser] */

export const lambdaHandler = async (event, context) => {

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  clientId = process.env.APPLICATION_CLIENT_ID;

  let res = ""

  try{

    const requestBody = event.body;

    const email = requestBody.email;          
    const password = requestBody.password;

    const command = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password
      },
      ClientId: clientId
    });

    res = client.send(command);

  }catch (error){

    return ({
      "statusCode": 400,
      "body": "Cognito sign in unsuccessful : " + error,
      "headers" : headers
    });

  }

  return ({
    "statusCode": 400,
    "body": "Cognito sign in successful : " + res,
    "headers" : headers
  });

}