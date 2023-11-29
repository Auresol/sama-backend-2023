import client from './samaDBConnect.mjs';
import { QueryCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { 
    CognitoIdentityProviderClient, 
    AdminAddUserToGroupCommand,
    SignUpCommand
} from "@aws-sdk/client-cognito-identity-provider";

export const lambdaHandler = async (event, context) => {

    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    };

    try{

        const tableName = process.env.ACT_TABLE;

        let email;
        //let password;
        let school;
        let type; 
        let firstname;
        let lastname;
        let classroom = "0/0";
        let number;
        let id;

        const requestBody = JSON.parse(event.body);

        try{

            email = requestBody.email;              //Require
            //password = requestBody.password;      //Require
            school = requestBody.school;            //Require
            type = requestBody.type;                //Require
            firstname = requestBody.firstname;      //Require
            lastname = requestBody.lastname;        //Require


            id = requestBody.id;                    //Optional
            number = requestBody.number;            //Optional
            classroom = requestBody.classroom;      //Optional

        }catch(error){

            return ({
                "statusCode": 400,
                "body": "Parameter is null : " + error,
                "headers" : headers
            });

        }

        let Indexnumber = (type == "STD"? "GSI1" : "GSI2");
        const GSIPKnumber = Indexnumber + "PK";

        if(type != "ADMIN"){

            const exist = new QueryCommand({
                TableName: tableName,
                IndexName: Indexnumber,
                KeyConditionExpression: GSIPKnumber + " = :partitionKey",
                ExpressionAttributeValues: {
                    ':partitionKey': email,
                },

            });

            const existResponse = await client.send(exist);
            
            // if accout does exist, return
            
            if(existResponse.Count != 0){
                return ({
                    "statusCode": 200,
                    "body": "Account already exists",
                    "headers" : headers
                });
            }
        }

        // get school data
        const schoolData = new GetCommand({
            TableName: tableName,
            Key : {
                "PK" : school,
                "SK" : "DATA"
            },

            ProjectionExpression : "act_amount"
        });

        console.info("school query");
        const schoolDataResponse = await client.send(schoolData);

        console.info(schoolDataResponse);

        const actAmount = 13;

        const createNewAccount = {
            TableName: tableName,
            Item : {
                "PK" : school,
                "SK" : type + "_" + classroom + "_" + firstname + "." + lastname,
                "GSISK" : "DATA"
            }
        };

        console.info(createNewAccount);

        createNewAccount.Item[GSIPKnumber] = email;

        if(number != undefined){
            createNewAccount.Item["number"] = number;
        }

        if(id != undefined){
            createNewAccount.Item["id"] = id;
        }

        for(let i = 1;i <= actAmount;i++){

            if(i < 10){

                createNewAccount.Item["stat_0" + (i.toString())] = [0,0,0,0];

            }else{

                createNewAccount.Item["stat_" + i.toString()] = [0,0,0,0];

            }
        }
    
        console.info(createNewAccount);


    //creating new account

    //Cognito
    /*
    const cognitoClient = new CognitoIdentityProviderClient({});

    try{

        const clientId = process.env.APPLICATION_CLIENT_ID;

        const cognitoSignUpCommand = new SignUpCommand({
            ClientId: clientId,
            Username: email,
            Password: password,
            //UserAttributes: [{ Name: "email", Value: email }],
        });

        const cognitoSignUpResponse = await cognitoClient.send(cognitoSignUpCommand);

        console.log(cognitoSignUpResponse);

    }catch (error){
        return ({
            "statusCode": 400,
            "body": "Cognito register unsuccessful : " + error,
            "headers" : headers
        });
    }
    
    */

    /*
    let groupName = "";
    if(type == "STD"){

        createNewAccount.Item["GSI1PK"] = email;
        //createNewAccount.Item["number"] = number;
        //createNewAccount.Item["statitic"] = statistic;
        groupName = process.env.STUDENT_GROUP_NAME;

    }else if(type == "TCH"){
        
        createNewAccount.Item["GSI2PK"] = email;
        groupName = process.env.TEACHER_GROUP_NAME;

    }else{

        groupName = process.env.ADMIN_GROUP_NAME;

    }
    
    try{

        const UserPoolId = process.env.USER_POOL_ID;

        const AddGroupCommand = new AdminAddUserToGroupCommand({ // AdminAddUserToGroupRequest
            UserPoolId: UserPoolId, 
            Username: email, 
            GroupName: groupName
        });

        const AddGroupResponse = await cognitoClient.send(AddGroupCommand);

    }catch (error){
        return ({
            "statusCode": 400,
            "body": "Cognito group assigner unsuccessful : " + error,
            "headers" : headers
        });
    }
    */
        const createNewAccountResponse = await client.send(new PutCommand(createNewAccount));

        return ({
            "statusCode": 200,
            "body": "register successful",
            "headers" : headers
        });

    }catch (error){
        return ({
            "statusCode": 400,
            "body": "Error : " + error,
            "headers" : headers
        });
    }
    
};



