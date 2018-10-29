const fs = require('fs');
const d3 = require('d3-dsv');
var jStat = require('jStat').jStat;
//Read TSV file
const reportFile = fs.readFileSync('./resources/Ad Performance Report.tsv', {encoding: 'ucs2'});

//Use d3.tsvParse to convert it to JS Object
const parsedReportFile = d3.tsvParse(reportFile);

//get column names of TSV file
const column = parsedReportFile.columns;

/* 
    Get Grouped JS object. i.e. if an ad group has multiple ads, then it will create an array which will have 
    multiple ads data inside an adgroup object
    {
        "Ad group ID":"1270395262",
        "ads":[{"Ad ID":"9783790282","Clicks":"5","Impressions":"768"},
            {"Ad ID":"36655885402","Clicks":"7","Impressions":"762"}]
        }
*/ 
var reportAfterGrouping = parseResponse(parsedReportFile, column);

//Do AB test on every add group and store the result in finalResult
var finalResult = doABTest(reportAfterGrouping);

//Use the final response to convert it into TSV file
convertToNormalTSV(finalResult, column);

/*
    returns P-value of normal distribution
*/

function NORMDIST(x, mean, sd, cumulative) {
    // Check parameters
    if (isNaN(x) || isNaN(mean) || isNaN(sd)) return 0;
    if (sd <= 0) return 0;
  
    // Return normal distribution computed by jStat [http://jstat.org]
    return (cumulative) ? jStat.normal.cdf(x, mean, sd) : jStat.normal.pdf(x, mean, sd);
  }

/*

*/
function isWinner(splitA, splitB) {
    var ad1 = splitA;
    var ad2 = splitB;

    var CTR1 = getClickThroughRate(ad1);
    var CTR2 = getClickThroughRate(ad2);

    var SD1 = getStandardDeviation(ad1, CTR1);
    var SD2 = getStandardDeviation(ad2, CTR2);

    var z_Score = (CTR1 - CTR2) / (Math.sqrt(Math.pow(SD1, 2) + Math.pow(SD2, 2)));
    var P_Value = NORMDIST(z_Score, 0, 1, true);
    if(P_Value < 0.05 || P_Value > 0.95) {
        return true;
    } else return false;
}

function getClickThroughRate(ad) {
    return ad.Clicks/ad.Impressions;
}

function getStandardDeviation(ad, clickThroughRate) {
    return Math.sqrt( clickThroughRate * ( 1 - clickThroughRate ) / ad.Impressions );
}

function parseResponse(response, column) {
    response = JSON.parse(JSON.stringify(response));
    var count = 0;
    var length = response.length;
    var indexMap = {};
    var featureList = [];
    for (var i = 0; i < length; i++) {
      const obj = response[i];
      var index = indexMap[obj[column[0]]];  
      if (index === undefined) {
        var adGroup = {};
        adGroup['Ad group ID'] = obj[column[0]];
        var ad = {};
        ad["Ad ID"] = obj["Ad ID"];
        ad["Clicks"] = obj["Clicks"];
        ad["Impressions"] = obj["Impressions"];
        adGroup.ads = [];
        adGroup.ads.push(ad);
        indexMap[obj[column[0]]] = count;
        featureList.push(adGroup);
        count++;      

      } else {
        var adGroup = featureList[index];
        var ad = {};
        ad["Ad ID"] = obj["Ad ID"];
        ad["Clicks"] = obj["Clicks"];
		ad["Impressions"] = obj["Impressions"];
        adGroup.ads.push(ad);
      
    }
  }
    return featureList;
  }

  function convertToNormalTSV(response, column) {
    var newTSV = [];
    while(response.length !== 0) {
        var obj = response.shift();
        for(var i = 0;i < obj.ads.length;i++) {
            var tempObj = {};
            tempObj[column[0]] = obj['Ad group ID'];
            tempObj[column[1]] = obj.ads[i][column[1]];
            // tempObj[column[2]] = obj.ads[i][column[2]];
            // tempObj[column[3]] = obj.ads[i][column[3]];
            tempObj['Result'] = obj['Result'];
            newTSV.push(tempObj);
        }
    }
    fs.writeFileSync('./resources/AdWinnerLoser.tsv', d3.tsvFormat(newTSV), 'ucs2');
  }



function doABTest(response) {
    response = JSON.parse(JSON.stringify(response));
    
    for(var i = 0;i < response.length;i++) {
        if(response[i].ads.length === 1) {
            response[i]['Result'] = 'NO_RESULT';
        } else {
            for(var firstSplit = 0;firstSplit < response[i].ads.length;firstSplit++) {
                var winnerCount = 0;
                for(var experimentalSplit = 0;experimentalSplit < response[i].ads.length;experimentalSplit++) {
                    if(firstSplit === experimentalSplit) continue;
                    if(isWinner(response[i].ads[firstSplit], response[i].ads[experimentalSplit])) winnerCount++;
                }
                if(winnerCount === response[i].ads.length - 1) {
                    response[i]['Result'] = 'WINNER';
                } else {
                    response[i]['Result'] = 'LOSER';
                }
            }
        }
    }
    return response;
}


  
  
  