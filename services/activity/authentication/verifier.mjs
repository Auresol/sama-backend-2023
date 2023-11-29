import { CognitoJwtVerifier } from "aws-jwt-verify";

export const verifierFunction = async (jwt_string) => {

    userPoolId = process.env.USER_POOL_ID;
    clientId = process.env.APPLICATION_CLIENT_ID;

    const verifier = CognitoJwtVerifier.create({
        userPoolId: userPoolId,
        tokenUse: "access",
        clientId: clientId
    });

    try {
        const payload = await verifier.verify(
            jwt_string
        );
        console.log("Token is valid. Payload:", payload);
    } catch {
        console.log("Token not valid!");
    }

};