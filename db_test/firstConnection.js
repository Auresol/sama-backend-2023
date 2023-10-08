

import { fileURLToPath } from "url";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ 
  region: "ap-southeast-1",
  endpoint: "http://localhost:8000",
 });
const docClient = DynamoDBDocumentClient.from(client);
