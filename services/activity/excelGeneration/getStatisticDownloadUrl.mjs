import client from './samaDBConnect.mjs';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

import { S3Client, GetObjectCommand, PutObjectCommand  } from "@aws-sdk/client-s3";
import { QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const ExcelJS = require('exceljs');

async function allActStructGetter(tableName, school){

    const getAllActStructCommand = {
        TableName: tableName,
        Key : {
            PK: school,
            SK: "DATA"
        }
    };

    let getAllActStructResponse;

    try{

        getAllActStructResponse = await client.send(new GetCommand(getAllActStructCommand));

    }catch (error){
        throw new Error(error);
    }

    if(getAllActStructResponse.Item == undefined){

        throw new Error("Item doesn't exist");           
        
    }  

    let all_act_struct = [];
    
    for(const item in getAllActStructResponse.Item){
        if(item.startsWith("act")){

            const act_type = item.split("_")[1];
            all_act_struct[act_type] = getAllActStructResponse.Item[item];
        }
    }

    return all_act_struct;

}

export const lambdaHandler = async (event, context) => {

    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    };

    const tableName = process.env.ACT_TABLE;
    const region = process.env.REGION;
    const samaDataBucket = process.env.SAMA_DATA_BUCKET;

    const requestPath = event.pathParameters;
    const requestQueryString = event.queryStringParameters;     

    const school = requestPath.school;                  //Require

    let stat_type;                                           //Require

    try{
        stat_type = requestQueryString.type;
        
    }catch{

        stat_type = "ALL";

    }

    let all_act_struct;

    try{
        all_act_struct = await allActStructGetter(tableName, school);

    }catch (error){
        return ({
            "statusCode": 400,
            "body": "get act stuct error :" + error.message,
            "headers" : headers
        });       
    }

    const getStaticListCommand = {
        
        TableName: tableName,
        KeyConditionExpression: "PK = :school AND begins_with(SK, :type)",
        ExpressionAttributeValues: {
            ":school" : school,
            ":type" : "STD"
        },

    };


    const getStaticListResponse = await client.send(new QueryCommand(getStaticListCommand));

    // create a workbook
    const workbook = excelGeneration(stat_type, getStaticListResponse.Items, all_act_struct);

    // Save the Excel file to a buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Upload the Excel file to S3
    const s3Client = new S3Client({ region : region });

    let uploadKey = 'statistic_excel/' + school + '/stat_ALL.xlsx';
    
    if(stat_type != "ALL"){
        uploadKey = 'statistic_excel/' + school + '/stat_' + stat_type.replace("/",".") + '.xlsx';
    }

    try {
        
        const putExcelCommand = new PutObjectCommand({

            Bucket : samaDataBucket,
            Key : uploadKey,
            Body : buffer 
            
        });

        const putExcelResponse = await s3Client.send(putExcelCommand);

    } catch (error) {

        return ({
            "statusCode": 400,
            "body": "Upload uncsuccessful : " + error,
            "headers" : headers
        });

    }

    const clientUrl = await createPresignedUrlWithClient({
        client: s3Client,
        bucket: samaDataBucket,
        key: uploadKey,
    });

    return ({
        "statusCode": 200,
        "body": JSON.stringify({ status : "Success", url : clientUrl}),
        "headers" : headers
    });
            
        
};

const createPresignedUrlWithClient = ({ client, bucket, key }) => {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    return getSignedUrl(client, command, { expiresIn: 3600 });
};

function excelGeneration(stat_type, raw_data, all_act_struct){

    const workbook = new ExcelJS.Workbook();

    const columnProperties = columnsGeneration();

    const stat_data = dataClassifier(raw_data, all_act_struct);
    
    if(stat_type == "ALL"){

        for(const year in stat_data){
            pageCreater(workbook, columnProperties, stat_data[year], year, all_act_struct);
        }

    }else{

        const stat_type_split = stat_type.split("/");
        const classyear = stat_type_split[0];
        const classroom = stat_type_split[1];

        if(stat_data[classyear][classroom] == undefined){
            throw new Error("Not a single human being presented here");
        }

        const temp = {};
        temp[classroom] = stat_data[classyear][classroom];
        
        pageCreater(workbook, columnProperties, temp, classyear, all_act_struct);

    }

    return workbook;

}

// function for rearrange data into new, usable format
// OLD FORMAT :
//  [
//      SK : {
//          id : id
//          name : name
//          number : number
//          stat_xx : [x,x,x,x]  
//      },
//  ]
//
// NEW FORMAT : 
//  [
//      year : {
//          room : {
//              data : [    --> stat for each student, sorted by their number
//                  {
//                      id : id
//                      names : names
//                      number : number
//                      xx : accept amoutn of that act
//                  }
//              ],
//              stat : {     --> stat for that year/room
//                  names : "สรุป " + year + "/" + room
//                  xx : finish % of that act
//              }
//          }
//       }
//  ]

function dataClassifier(raw_data, all_act_struct){

    let classify_data = {};
    let stat_unfinish = {};

    for(const i in raw_data){

        const person = raw_data[i];

        let new_person = {}

        const sk_split = person.SK.split("_");
        const class_split = sk_split[1].split("/");

        const classyear = class_split[0];
        const classroom = class_split[1];

        new_person["id"] = person.id;
        new_person["names"] = sk_split[2].replace("."," ");
        new_person["number"] = person.number;


        if(classify_data[classyear] == undefined){
            classify_data[classyear] = {};
            stat_unfinish[classyear] = {};

        }
        
        if(classify_data[classyear][classroom] == undefined){
            classify_data[classyear][classroom] = { "data" : [], "stat" : {} }; 
            stat_unfinish[classyear][classroom] = {};

        }

        for(const statwise in person){

            if(statwise.startsWith("stat")){
                
                // act_id_temp = xx , INT
                const act_id_temp = statwise.split("_")[1];

                // ACCEPT only
                new_person[act_id_temp] = person[statwise][2];

                if(new_person[act_id_temp] < all_act_struct[act_id_temp].max){

                    if(stat_unfinish[classyear][classroom][act_id_temp] == undefined){
                        stat_unfinish[classyear][classroom][act_id_temp] = 1;

                    }else{
                        stat_unfinish[classyear][classroom][act_id_temp] += 1;

                    }

                }

            }

        }

        classify_data[classyear][classroom]["data"].push(new_person); 
    }

    for(const year in classify_data){
        for(const room in classify_data[year]){

            classify_data[year][room]["data"].sort(function(a,b){
                return a.number - b.number;
            });

            let stat_summary = {
                "names" : "สรุป " + year + "/" + room
            };

            const std_amount = classify_data[year][room]["data"].length;
            
            for(const key in all_act_struct){
                if(key in stat_unfinish[year][room]){

                    stat_summary[key] = (std_amount - stat_unfinish[year][room][key])/std_amount;
                }else{

                    stat_summary[key] = 1;
                }
            }

            classify_data[year][room]["stat"] = stat_summary;

        }
    }   

    
    return classify_data;
};

// function for create column in each pages
function columnsGeneration(){

    let columnProperties = [
        {
            'header' : "ชื่อ",
            'key' : 'names',
            'width' : 20
        },
        {
            'header' : "รหัสประจำตัว",
            'key' : 'id',
            'width' : 20
        },
        {
            'header' : "เลขที่",
            'key' : 'number',
            'width' : 20
        }
    ];

    const lowPriorityColumnProperties = [];

    for(const actNum in all_act_struct){

        const act = all_act_struct[actNum];

        if("priority" in act && act.priority == -1){

            lowPriorityColumnProperties.push({
                'header' : act.act_name + " ( /" + act.max + " " + act.unit + ")",
                'key' : actNum,
                'width' : 20,
                'height' : 30
            })

        }else{

            columnProperties.push({
                'header' : act.act_name + " ( /" + act.max + " " + act.unit + ")",
                'key' : actNum,
                'width' : 20,
                'height' : 30
            })

        }
    }

    columnProperties = columnProperties.concat(lowPriorityColumnProperties);

    return columnProperties;

}

// function for create all page in excel, including data
function pageCreater(workbook, columnsProperties, std_data, year, all_act_struct){

    const worksheetProperties = {
        views : [
            {
                state: 'frozen', 
                xSplit: 1,
                ySplit: 1
            }
        ]
    };

    const classShiftBorder = {
        top: {style:'thin'},
        bottom: {style:'thin'},
    };

    const worksheet = workbook.addWorksheet('ม.' + year, worksheetProperties);
    worksheet.columns = columnsProperties;
    const toprow = worksheet.getRow(1);
    toprow.height = 40;
    toprow.alignment = { 
        vertical: 'middle', 
        horizontal: 'center',
        wrapText: true 
    };

    toprow.border = {
        bottom: {style:'double'},
    }

    for(const room in std_data){

        const header_row = worksheet.addRow({ "names" : year + "/" + room });
        header_row.border = classShiftBorder;
        header_row.height = 25;

        for(const personPos in std_data[room]["data"]){

            const person = std_data[room]["data"][personPos];

            const newRow = worksheet.addRow(person);

            for(const key in person){

                if(key in all_act_struct && person[key] < all_act_struct[key]["max"]){

                    newRow.getCell(key).fill = {
                        type: 'pattern',
                        pattern:'solid',
                        fgColor: { argb:'F0FF87' }
                    };

                }

            }
        }

        const stat_row_temp = std_data[room]["stat"]
        const stat_row = worksheet.addRow(stat_row_temp);

        stat_row.fill = {
            type: 'pattern',
            pattern:'solid',
            fgColor: { argb: 'CCFFCC' }
        }

        for(const key in stat_row_temp){

            if(key != "names" && stat_row_temp[key] < 1){

                stat_row.getCell(key).fill = {
                    type: 'pattern',
                    pattern:'solid',
                    fgColor: { argb:'FFFF99' }
                };


            }
        }

        stat_row.numFmt = '0.00%';
        stat_row.border = classShiftBorder;

        worksheet.addRow({});

    }

}




