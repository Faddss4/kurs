(() => {
  let journalData = [];
  let editIndex = null;

  // Элементы интерфейса
  const tabs = document.querySelectorAll('nav button.tab-btn');
  const sections = document.querySelectorAll('section');

  const fileInput = document.getElementById('fileInput');
  const loadFileBtn = document.getElementById('loadFileBtn');
  const uploadMessage = document.getElementById('uploadMessage');
  const uploadTableHeader = document.getElementById('uploadTableHeader');
  const uploadTableBody = document.getElementById('uploadTableBody');

  const classInput = document.getElementById('classInput');
  const fioInput = document.getElementById('fioInput');
  const subjectInput = document.getElementById('subjectInput');
  const gradeInput = document.getElementById('gradeInput');
  const addRecordBtn = document.getElementById('addRecordBtn');
  const saveJournalBtn = document.getElementById('saveJournalBtn');
  const editMessage = document.getElementById('editMessage');
  const journalTableBody = document.getElementById('journalTableBody');

  const statsTableContainer = document.getElementById('statsTableContainer');

  const graphCanvas = document.getElementById('graphCanvas');
  const ctx = graphCanvas.getContext('2d');
  const graphClassSelect = document.getElementById('graphClassSelect');
  const graphSubjectSelect = document.getElementById('graphSubjectSelect');
  const drawGraphBtn = document.getElementById('drawGraphBtn');

  // Навигация по вкладкам
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const tabName = tab.dataset.tab;
      sections.forEach(sec => {
        sec.id === tabName ? sec.classList.add('active') : sec.classList.remove('active');
      });
      if(tabName === 'stats-table') renderStatsTable();
      if(tabName === 'stats-graph') {
        fillGraphSelectors();
        clearCanvas();
      }
    });
  });

  // Загрузка файлов с поддержкой кодировок и форматов
  loadFileBtn.addEventListener('click', () => {
    const file = fileInput.files[0];
    uploadMessage.textContent = '';
    if(!file) {
      uploadMessage.textContent = 'Выберите файл для загрузки!';
      uploadMessage.className = 'error';
      return;
    }
    const ext = file.name.split('.').pop().toLowerCase();
    if(!['csv','txt','xlsx'].includes(ext)) {
      uploadMessage.textContent = 'Поддерживаются только файлы .csv, .txt и .xlsx';
      uploadMessage.className = 'error';
      return;
    }

    if(ext === 'xlsx') {
      const reader = new FileReader();
      reader.onload = e => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const csvText = XLSX.utils.sheet_to_csv(worksheet);
        parseText(csvText);
      };
      reader.readAsArrayBuffer(file);
    } else {
      const reader = new FileReader();
      reader.onload = e => {
        const uint8Array = new Uint8Array(e.target.result);
        let encoding = Encoding.detect(uint8Array);
        if(encoding !== 'UTF8' && encoding !== 'ASCII') encoding = 'CP1251';
        const unicodeString = Encoding.convert(uint8Array, {to:"UNICODE", from:encoding, type:"string"});
        parseText(unicodeString);
      };
      reader.readAsArrayBuffer(file);
    }
  });

  // Парсинг CSV/TXT текста в записи
  function parseText(text) {
    const lines = text.trim().split(/\r?\n/);
    const parsed = [];
    for(let i=0; i<lines.length; i++) {
      let line = lines[i].trim();
      if(!line) continue;
      let parts = line.split(/[,;\t]/).map(p => p.trim());
      if(parts.length !== 4) {
        uploadMessage.textContent = `Ошибка в строке ${i+1}: должно быть 4 поля (Класс, ФИО, Предмет, Оценка)`;
        uploadMessage.className = 'error';
        return;
      }
      let [cl, fio, subj, grade] = parts;
      grade = Number(grade);
      if(isNaN(grade) || grade < 1 || grade > 5) {
        uploadMessage.textContent = `Ошибка в строке ${i+1}: оценка должна быть числом от 1 до 5`;
        uploadMessage.className = 'error';
        return;
      }
      parsed.push({class: cl, fio: fio, subject: subj, grade: grade});
    }
    if(parsed.length === 0) {
      uploadMessage.textContent = 'Файл пуст или не содержит корректных данных';
      uploadMessage.className = 'error';
      return;
    }
    journalData = journalData.concat(parsed);
    uploadMessage.textContent = `Успешно загружено ${parsed.length} записей`;
    uploadMessage.className = 'success';
    renderUploadTable(parsed);
    renderJournalTable();
  }

  // Отобразить загруженные данные
  function renderUploadTable(data) {
    uploadTableHeader.innerHTML = '';
    uploadTableBody.innerHTML = '';
    if(data.length === 0) return;
    ['Класс', 'ФИО', 'Предмет', 'Оценка'].forEach(h => {
      const th = document.createElement('th');
      th.textContent = h;
      uploadTableHeader.appendChild(th);
    });
    data.forEach(row => {
      const tr = document.createElement('tr');
      ['class','fio','subject','grade'].forEach(key => {
        const td = document.createElement('td');
        td.textContent = row[key];
        tr.appendChild(td);
      });
      uploadTableBody.appendChild(tr);
    });
  }

  // Добавление/редактирование записи
  addRecordBtn.addEventListener('click', () => {
    editMessage.textContent = '';
    let cl = classInput.value.trim();
    let fio = fioInput.value.trim();
    let subj = subjectInput.value.trim();
    let grade = Number(gradeInput.value);
    if(!cl || !fio || !subj || !grade) {
      editMessage.textContent = 'Заполните все поля корректно.';
      editMessage.className = 'error';
      return;
    }
    if(editIndex === null) {
      journalData.push({class: cl, fio: fio, subject: subj, grade: grade});
      editMessage.textContent = 'Запись добавлена.';
      editMessage.className = 'success';
    } else {
      journalData[editIndex] = {class: cl, fio: fio, subject: subj, grade: grade};
      editMessage.textContent = 'Запись обновлена.';
      editMessage.className = 'success';
      editIndex = null;
      addRecordBtn.textContent = 'Добавить запись';
    }
    clearEditInputs();
    renderJournalTable();
  });

  // Сохранение журнала в выбранном формате
  saveJournalBtn.addEventListener('click', () => {
    const format = prompt('Введите формат для сохранения: csv, txt или xlsx', 'csv');
    if(!format) return;
    saveJournal(format.toLowerCase());
  });

  function saveJournal(format) {
    if (journalData.length === 0) {
      alert('Журнал пуст, нечего сохранять.');
      return;
    }

    if (format === 'csv' || format === 'txt') {
      const delimiter = format === 'csv' ? ',' : '\t';
      const content = journalData.map(r =>
        [r.class, r.fio, r.subject, r.grade].join(delimiter)
      ).join('\n');

      const mimeType = format === 'csv' ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8';
      const filename = format === 'csv' ? 'journal.csv' : 'journal.txt';

      downloadFile(content, mimeType, filename);

    } else if (format === 'xlsx') {
      const wb = XLSX.utils.book_new();
      const wsData = [['Класс', 'ФИО', 'Предмет', 'Оценка']];
      journalData.forEach(r => {
        wsData.push([r.class, r.fio, r.subject, r.grade]);
      });
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, 'Журнал');
      XLSX.writeFile(wb, 'journal.xlsx');

    } else {
      alert('Неподдерживаемый формат для сохранения.');
    }
  }

  function downloadFile(content, mimeType, filename) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Отобразить журнал с кнопками редактирования и удаления
  function renderJournalTable() {
    journalTableBody.innerHTML = '';
    journalData.forEach((row, idx) => {
      const tr = document.createElement('tr');
      ['class','fio','subject','grade'].forEach(key => {
        const td = document.createElement('td');
        td.textContent = row[key];
        tr.appendChild(td);
      });
      const actionsTd = document.createElement('td');

      const editBtn = document.createElement('button');
      editBtn.textContent = 'Редактировать';
      editBtn.className = 'action-btn';
      editBtn.style.backgroundColor = '#2980b9';
      editBtn.addEventListener('click', () => {
        editIndex = idx;
        classInput.value = row.class;
        fioInput.value = row.fio;
        subjectInput.value = row.subject;
        gradeInput.value = row.grade;
        addRecordBtn.textContent = 'Сохранить изменения';
        editMessage.textContent = '';
        scrollToTop();
      });
      actionsTd.appendChild(editBtn);

      const delBtn = document.createElement('button');
      delBtn.textContent = 'Удалить';
      delBtn.className = 'action-btn';
      delBtn.style.backgroundColor = '#c0392b';
      delBtn.addEventListener('click', () => {
        if(confirm(`Удалить запись: ${row.fio}, ${row.subject}, оценка ${row.grade}?`)) {
          journalData.splice(idx, 1);
          renderJournalTable();
          editMessage.textContent = 'Запись удалена.';
          editMessage.className = 'success';
          if(editIndex === idx) {
            editIndex = null;
            clearEditInputs();
            addRecordBtn.textContent = 'Добавить запись';
          }
        }
      });
      actionsTd.appendChild(delBtn);

      tr.appendChild(actionsTd);
      journalTableBody.appendChild(tr);
    });
  }

  function clearEditInputs() {
    classInput.value = '';
    fioInput.value = '';
    subjectInput.value = '';
    gradeInput.value = '';
  }

  function scrollToTop() {
    window.scrollTo({top: 0, behavior: 'smooth'});
  }

  // Статистика (таблица)
  function renderStatsTable() {
    statsTableContainer.innerHTML = '';
    if(journalData.length === 0) {
      statsTableContainer.textContent = 'Данные журнала отсутствуют.';
      return;
    }

    const stats = {};
    const allSubjectsSet = new Set();
    const allClassesSet = new Set();

    journalData.forEach(({class: cl, subject: subj, grade}) => {
      allSubjectsSet.add(subj);
      allClassesSet.add(cl);
      if(!stats[cl]) stats[cl] = {};
      if(!stats[cl][subj]) stats[cl][subj] = [];
      stats[cl][subj].push(grade);
    });

    function average(arr) {
      if(arr.length === 0) return 0;
      return arr.reduce((a,b) => a+b, 0) / arr.length;
    }
    function median(arr) {
      if(arr.length === 0) return 0;
      const sorted = arr.slice().sort((a,b) => a-b);
      const mid = Math.floor(sorted.length / 2);
      if(sorted.length % 2 === 0) {
        return (sorted[mid-1] + sorted[mid]) / 2;
      } else {
        return sorted[mid];
      }
    }
    function gradeCounts(arr) {
      const counts = {1:0,2:0,3:0,4:0,5:0};
      arr.forEach(g => {
        if(counts[g] !== undefined) counts[g]++;
      });
      return counts;
    }

    const overallStats = {};
    allSubjectsSet.forEach(subj => {
      overallStats[subj] = [];
    });
    journalData.forEach(({subject: subj, grade}) => {
      overallStats[subj].push(grade);
    });

    const container = document.createElement('div');

    allClassesSet.forEach(cl => {
      const h3 = document.createElement('h3');
      h3.textContent = `Класс ${cl}`;
      container.appendChild(h3);
      const table = document.createElement('table');
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
      ['Предмет', 'Средняя оценка', 'Медиана', 'Оценка', 'Количество', 'Процент'].forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);
      const tbody = document.createElement('tbody');

      Object.keys(stats[cl]).forEach(subj => {
        const grades = stats[cl][subj];
        const avg = average(grades).toFixed(2);
        const med = median(grades).toFixed(2);
        const counts = gradeCounts(grades);
        const total = grades.length;

        for(let grade = 1; grade <= 5; grade++) {
          const tr = document.createElement('tr');
          if(grade === 1) {
            const tdSubj = document.createElement('td');
            tdSubj.textContent = subj;
            tdSubj.rowSpan = 5;
            tr.appendChild(tdSubj);

            const tdAvg = document.createElement('td');
            tdAvg.textContent = avg;
            tdAvg.rowSpan = 5;
            tr.appendChild(tdAvg);

            const tdMed = document.createElement('td');
            tdMed.textContent = med;
            tdMed.rowSpan = 5;
            tr.appendChild(tdMed);
          }
          const tdGrade = document.createElement('td');
          tdGrade.textContent = grade;
          tr.appendChild(tdGrade);

          const tdCount = document.createElement('td');
          tdCount.textContent = counts[grade];
          tr.appendChild(tdCount);

          const tdPercent = document.createElement('td');
          tdPercent.textContent = total ? ((counts[grade]/total)*100).toFixed(1) + '%' : '0%';
          tr.appendChild(tdPercent);

          tbody.appendChild(tr);
        }
      });
      table.appendChild(tbody);
      container.appendChild(table);
    });

    const h3Overall = document.createElement('h3');
    h3Overall.textContent = 'Общая статистика по всем классам';
    container.appendChild(h3Overall);
    const tableOverall = document.createElement('table');
    const theadOverall = document.createElement('thead');
    const headerRowOverall = document.createElement('tr');
    ['Предмет', 'Средняя оценка', 'Медиана', 'Оценка', 'Количество', 'Процент'].forEach(h => {
      const th = document.createElement('th');
      th.textContent = h;
      headerRowOverall.appendChild(th);
    });
    theadOverall.appendChild(headerRowOverall);
    tableOverall.appendChild(theadOverall);
    const tbodyOverall = document.createElement('tbody');

    Object.keys(overallStats).forEach(subj => {
      const grades = overallStats[subj];
      const avg = average(grades).toFixed(2);
      const med = median(grades).toFixed(2);
      const counts = gradeCounts(grades);
      const total = grades.length;

      for(let grade = 1; grade <= 5; grade++) {
        const tr = document.createElement('tr');
        if(grade === 1) {
          const tdSubj = document.createElement('td');
          tdSubj.textContent = subj;
          tdSubj.rowSpan = 5;
          tr.appendChild(tdSubj);

          const tdAvg = document.createElement('td');
          tdAvg.textContent = avg;
          tdAvg.rowSpan = 5;
          tr.appendChild(tdAvg);

          const tdMed = document.createElement('td');
          tdMed.textContent = med;
          tdMed.rowSpan = 5;
          tr.appendChild(tdMed);
        }
        const tdGrade = document.createElement('td');
        tdGrade.textContent = grade;
        tr.appendChild(tdGrade);

        const tdCount = document.createElement('td');
        tdCount.textContent = counts[grade];
        tr.appendChild(tdCount);

        const tdPercent = document.createElement('td');
        tdPercent.textContent = total ? ((counts[grade]/total)*100).toFixed(1) + '%' : '0%';
        tr.appendChild(tdPercent);

        tbodyOverall.appendChild(tr);
      }
    });
    tableOverall.appendChild(tbodyOverall);
    container.appendChild(tableOverall);

    statsTableContainer.appendChild(container);
  }

  // Статистика (графики)
  function fillGraphSelectors() {
    const classes = Array.from(new Set(journalData.map(r => r.class))).sort();
    const subjects = Array.from(new Set(journalData.map(r => r.subject))).sort();

    graphClassSelect.innerHTML = '<option value="all">Все классы</option>';
    graphSubjectSelect.innerHTML = '<option value="all">Все предметы</option>';

    classes.forEach(cl => {
      const option = document.createElement('option');
      option.value = cl;
      option.textContent = cl;
      graphClassSelect.appendChild(option);
    });
    subjects.forEach(subj => {
      const option = document.createElement('option');
      option.value = subj;
      option.textContent = subj;
      graphSubjectSelect.appendChild(option);
    });
  }

  drawGraphBtn.addEventListener('click', () => {
    drawGraph();
  });

  function clearCanvas() {
    ctx.clearRect(0, 0, graphCanvas.width, graphCanvas.height);
  }

  function drawGraph() {
    clearCanvas();
    if(journalData.length === 0) {
      ctx.fillStyle = 'black';
      ctx.font = '16px Arial';
      ctx.fillText('Данные журнала отсутствуют.', 10, 50);
      return;
    }
    const selectedClass = graphClassSelect.value;
    const selectedSubject = graphSubjectSelect.value;

    let filtered = journalData;
    if(selectedClass !== 'all') filtered = filtered.filter(r => r.class === selectedClass);
    if(selectedSubject !== 'all') filtered = filtered.filter(r => r.subject === selectedSubject);

    if(filtered.length === 0) {
      ctx.fillStyle = 'black';
      ctx.font = '16px Arial';
      ctx.fillText('Нет данных для выбранных параметров.', 10, 50);
      return;
    }

    const counts = {1:0,2:0,3:0,4:0,5:0};
    filtered.forEach(r => {
      if(counts[r.grade] !== undefined) counts[r.grade]++;
    });
    const total = filtered.length;

    const padding = 50;
    const width = graphCanvas.width - padding * 2;
    const height = graphCanvas.height - padding * 2;
    const barWidth = width / 7;
    const maxCount = Math.max(...Object.values(counts), 1);
    const scale = height / maxCount;

    ctx.strokeStyle = '#333';
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, padding + height);
    ctx.lineTo(padding + width, padding + height);
    ctx.stroke();

    ctx.fillStyle = 'black';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const steps = 5;
    for(let i=0; i<=steps; i++) {
      const y = padding + height - (height/steps)*i;
      const val = Math.round(maxCount/steps*i);
      ctx.fillText(val, padding - 5, y);
      ctx.strokeStyle = '#ccc';
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(padding + width, y);
      ctx.stroke();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const colors = ['#e74c3c','#e67e22','#f1c40f','#2ecc71','#3498db'];
    let i = 0;
    for(let grade = 1; grade <= 5; grade++) {
      const count = counts[grade];
      const barHeight = count * scale;
      const x = padding + barWidth * (i+1);
      const y = padding + height - barHeight;

      ctx.fillStyle = colors[i];
      ctx.fillRect(x, y, barWidth, barHeight);

      ctx.fillStyle = 'black';
      ctx.font = '14px Arial';
      ctx.fillText(grade, x + barWidth/2, padding + height + 5);

      ctx.fillText(count, x + barWidth/2, y - 18);

      i++;
    }

    ctx.fillStyle = 'black';
    ctx.font = '18px Arial';
    ctx.textAlign = 'center';
    let title = 'Распределение оценок';
    if(selectedClass !== 'all') title += ` для класса ${selectedClass}`;
    if(selectedSubject !== 'all') title += ` по предмету ${selectedSubject}`;
    ctx.fillText(title, graphCanvas.width/2, 30);

    const gradesArr = filtered.map(r => r.grade);
    const avg = (gradesArr.reduce((a,b) => a+b, 0) / gradesArr.length).toFixed(2);
    const med = median(gradesArr).toFixed(2);
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Средняя оценка: ${avg}`, padding, padding - 10);
    ctx.fillText(`Медиана: ${med}`, padding + 200, padding - 10);
  }

  function median(arr) {
    if(arr.length === 0) return 0;
    const sorted = arr.slice().sort((a,b) => a-b);
    const mid = Math.floor(sorted.length / 2);
    if(sorted.length % 2 === 0) {
      return (sorted[mid-1] + sorted[mid]) / 2;
    } else {
      return sorted[mid];
    }
  }

  // Инициализация
  renderJournalTable();

})();
