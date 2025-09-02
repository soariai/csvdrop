/*
 * CSVdrop front‑end logic
 *
 * Handles CSV parsing, dynamic table creation with editable fields,
 * modification toggles via checkboxes, CSV downloading, and combining
 * multiple CSV files through a serverless backend. The nostalgic design
 * of CSVdrop is inspired by early Macintosh UI aesthetics.
 */

document.addEventListener('DOMContentLoaded', () => {
  const csvInput = document.getElementById('csvFileInput');
  const tableContainer = document.getElementById('tableContainer');
  const downloadButton = document.getElementById('downloadButton');
  const combineInput = document.getElementById('combineInput');
  const combineButton = document.getElementById('combineButton');

  // Holds the parsed CSV data as an array of objects
  let csvData = [];

  /**
   * Build and render the table based on csvData.
   * Each column header contains a checkbox to enable editing for that column.
   */
  function buildTable() {
    tableContainer.innerHTML = '';
    if (!csvData || !csvData.length) {
      return;
    }

    const table = document.createElement('table');
    table.className = 'csv-table';
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    // Create header cells with checkboxes
    Object.keys(csvData[0]).forEach((col) => {
      const th = document.createElement('th');
      // Column name label
      const label = document.createElement('span');
      label.textContent = col;
      th.appendChild(label);
      // Line break for spacing
      th.appendChild(document.createElement('br'));
      // Checkbox to toggle editing for this column
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.dataset.column = col;
      checkbox.className = 'modify-checkbox';
      checkbox.title = `Enable editing for column ${col}`;
      th.appendChild(checkbox);
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Build table body
    const tbody = document.createElement('tbody');
    csvData.forEach((row, rowIndex) => {
      const tr = document.createElement('tr');
      Object.keys(row).forEach((col) => {
        const td = document.createElement('td');
        td.dataset.column = col;
        td.dataset.rowIndex = String(rowIndex);
        td.textContent = row[col];
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tableContainer.appendChild(table);

    // Attach event listeners for each modify checkbox
    const checkboxes = document.querySelectorAll('.modify-checkbox');
    checkboxes.forEach((cb) => {
      cb.addEventListener('change', (e) => toggleModification(e.target));
    });
  }

  /**
   * Toggle editing for a specific column based on checkbox state.
   * When enabled, convert table cells to editable input fields.
   * When disabled, revert cells to plain text and update csvData.
   *
   * @param {HTMLInputElement} checkbox The checkbox triggering the toggle
   */
  function toggleModification(checkbox) {
    const col = checkbox.dataset.column;
    const isChecked = checkbox.checked;
    // Select all cells for this column
    const cells = tableContainer.querySelectorAll(`td[data-column='${col}']`);
    cells.forEach((cell) => {
      const rowIndex = Number(cell.dataset.rowIndex);
      const currentValue = csvData[rowIndex][col];
      if (isChecked) {
        // Replace cell contents with an input element for editing
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentValue;
        input.dataset.column = col;
        input.dataset.rowIndex = String(rowIndex);
        input.addEventListener('input', function () {
          const ri = Number(this.dataset.rowIndex);
          const column = this.dataset.column;
          // Update the csvData object live as the user types
          csvData[ri][column] = this.value;
        });
        cell.textContent = '';
        cell.appendChild(input);
      } else {
        // Commit any pending input value and revert back to plain text
        const textValue = currentValue;
        cell.textContent = textValue;
      }
    });
  }

  /**
   * Parse CSV file on input change using Papa Parse.
   * After parsing, build the editable table and reveal the download button.
   */
  csvInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) {
      return;
    }
    Papa.parse(file, {
      header: true,
      dynamicTyping: false,
      skipEmptyLines: true,
      complete: function (results) {
        csvData = results.data;
        buildTable();
        downloadButton.style.display = 'inline-block';
      },
      error: function (err) {
        alert('Error parsing CSV file: ' + err.message);
      },
    });
  });

  /**
   * Download the modified CSV. Converts csvData back into a CSV string
   * and triggers a file download in the browser.
   */
  downloadButton.addEventListener('click', () => {
    if (!csvData || !csvData.length) {
      alert('No CSV loaded to download.');
      return;
    }
    const csvString = Papa.unparse(csvData);
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'modified.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });

  /**
   * Combine multiple CSV files on the server via a serverless function.
   * Sends a FormData payload to the Netlify function endpoint and
   * downloads the returned combined CSV.
   */
  combineButton.addEventListener('click', () => {
    const files = combineInput.files;
    if (!files || files.length < 2) {
      alert('Please select at least two CSV files to combine.');
      return;
    }
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }
    // Disable button to prevent double‑clicks
    combineButton.disabled = true;
    combineButton.textContent = 'Combining...';
    fetch('/.netlify/functions/process-csv', {
      method: 'POST',
      body: formData,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'combined.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      })
      .catch((err) => {
        alert('Error combining files: ' + err.message);
      })
      .finally(() => {
        combineButton.disabled = false;
        combineButton.textContent = 'Combine and Download';
      });
  });
});
