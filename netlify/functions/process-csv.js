/*
 * Netlify Serverless Function: process-csv
 *
 * This handler accepts a POST request containing one or more CSV files
 * in multipart/form-data format. It parses each CSV, concatenates
 * all rows, removes empty rows and duplicate rows, and returns the
 * resulting CSV as a downloadable file.
 *
 * Dependencies: papaparse, formidable, json2csv
 */

const formidable = require('formidable');
const fs = require('fs');
const Papa = require('papaparse');
const { Parser } = require('json2csv');

exports.handler = async function (event, context) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed',
    };
  }

  return new Promise((resolve) => {
    const form = formidable({ multiples: true });
    // Netlify provides event.rawBody which formidable can parse
    form.parse(event, (err, fields, files) => {
      if (err) {
        return resolve({ statusCode: 500, body: 'Error parsing form data' });
      }
      // 'files' may be a single file or an array of files under the key 'files'
      let fileArray = [];
      if (files.files) {
        fileArray = Array.isArray(files.files) ? files.files : [files.files];
      }
      if (!fileArray.length) {
        return resolve({ statusCode: 400, body: 'No files uploaded' });
      }
      let allData = [];
      try {
        fileArray.forEach((file) => {
          const content = fs.readFileSync(file.filepath || file.path, 'utf8');
          const results = Papa.parse(content, { header: true, skipEmptyLines: true });
          // results.data is an array of objects; we concatenate all
          allData = allData.concat(results.data);
        });
        // Remove completely empty rows (where all columns are blank)
        allData = allData.filter((row) => {
          return Object.values(row).some((value) => value !== null && value !== undefined && String(value).trim() !== '');
        });
        // Remove duplicate rows based on JSON stringification of the row
        const uniqueData = [];
        const seen = new Set();
        allData.forEach((row) => {
          const key = JSON.stringify(row);
          if (!seen.has(key)) {
            seen.add(key);
            uniqueData.push(row);
          }
        });
        // Convert back to CSV using json2csv
        const json2csvParser = new Parser();
        const csv = json2csvParser.parse(uniqueData);
        return resolve({
          statusCode: 200,
          headers: {
            'Content-Type': 'text/csv',
            // Provide a filename to trigger download in browser
            'Content-Disposition': 'attachment; filename="combined.csv"',
          },
          body: csv,
        });
      } catch (error) {
        return resolve({ statusCode: 500, body: 'Server error processing CSV files' });
      }
    });
  });
};
