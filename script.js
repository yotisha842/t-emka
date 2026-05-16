// массив всех транзакций
let transactions = [];

// id транзакции которую сейчас редактируем (null = добавляем новую)
let editId = null;

// читаем данные из localStorage при загрузке
const saved = localStorage.getItem('transactions');
if (saved) {
    transactions = JSON.parse(saved);
}

// тёмная тема - восстанавливаем состояние
if (localStorage.getItem('dark') === '1') {
    document.body.classList.add('dark');
    document.getElementById('themeBtn').textContent = 'Светлая тема';
}

// ставим сегодняшнюю дату в форму
document.getElementById('date').value = new Date().toISOString().slice(0, 10);

// сохраняем массив в localStorage
function save() {
    localStorage.setItem('transactions', JSON.stringify(transactions));
}

// переключение тёмной темы
function toggleTheme() {
    if (document.body.classList.contains('dark')) {
        document.body.classList.remove('dark');
        document.getElementById('themeBtn').textContent = 'Тёмная тема';
        localStorage.setItem('dark', '0');
    } else {
        document.body.classList.add('dark');
        document.getElementById('themeBtn').textContent = 'Светлая тема';
        localStorage.setItem('dark', '1');
    }
}

// форма добавления / редактирования
const form = document.getElementById('form');

form.addEventListener('submit', function(e) {
    e.preventDefault();

    const type     = document.getElementById('type').value;
    const amount   = Number(document.getElementById('amount').value);
    const category = document.getElementById('category').value;
    const date     = document.getElementById('date').value;
    const comment  = document.getElementById('comment').value;

    if (amount <= 0) {
        alert('Сумма должна быть больше 0');
        return;
    }

    if (editId !== null) {
        // редактирование - находим и обновляем
        for (let i = 0; i < transactions.length; i++) {
            if (transactions[i].id === editId) {
                transactions[i].type     = type;
                transactions[i].amount   = amount;
                transactions[i].category = category;
                transactions[i].date     = date;
                transactions[i].comment  = comment;
                break;
            }
        }
        cancelEdit();
    } else {
        // добавляем новую
        const newItem = {
            id: Date.now(),
            type: type,
            amount: amount,
            category: category,
            date: date,
            comment: comment
        };
        transactions.push(newItem);
    }

    save();
    render();

    document.getElementById('amount').value  = '';
    document.getElementById('comment').value = '';
});

// нажали "Редактировать" - заполняем форму данными
function startEdit(id) {
    let t = null;
    for (let i = 0; i < transactions.length; i++) {
        if (transactions[i].id === id) {
            t = transactions[i];
            break;
        }
    }
    if (!t) return;

    editId = id;

    document.getElementById('type').value     = t.type;
    document.getElementById('amount').value   = t.amount;
    document.getElementById('category').value = t.category;
    document.getElementById('date').value     = t.date;
    document.getElementById('comment').value  = t.comment;

    document.getElementById('formTitle').textContent = 'Редактировать транзакцию';
    document.getElementById('submitBtn').textContent = 'Сохранить';
    document.getElementById('cancelBtn').style.display = 'inline-block';

    // прокручиваем к форме
    document.querySelector('.form-box').scrollIntoView({ behavior: 'smooth' });
}

// отмена редактирования
function cancelEdit() {
    editId = null;
    form.reset();
    document.getElementById('date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('formTitle').textContent = 'Новая транзакция';
    document.getElementById('submitBtn').textContent = 'Добавить';
    document.getElementById('cancelBtn').style.display = 'none';
}

// удаление
function deleteItem(id) {
    if (editId === id) cancelEdit();
    transactions = transactions.filter(function(t) {
        return t.id !== id;
    });
    save();
    render();
}

// главная функция - рисуем страницу
function render() {
    renderList();
    updateStats();
}

// рендер списка с учётом фильтров и сортировки
function renderList() {
    const list = document.getElementById('list');

    const filterType     = document.getElementById('filterType').value;
    const filterCategory = document.getElementById('filterCategory').value;
    const sortBy         = document.getElementById('sortBy').value;

    // фильтрация
    let arr = transactions.slice();

    if (filterType !== 'all') {
        arr = arr.filter(function(t) { return t.type === filterType; });
    }

    if (filterCategory !== 'all') {
        arr = arr.filter(function(t) { return t.category === filterCategory; });
    }

    // сортировка
    if (sortBy === 'date') {
        arr.sort(function(a, b) { return new Date(b.date) - new Date(a.date); });
    } else if (sortBy === 'amount') {
        arr.sort(function(a, b) { return b.amount - a.amount; });
    } else if (sortBy === 'category') {
        arr.sort(function(a, b) { return a.category.localeCompare(b.category); });
    }

    if (arr.length === 0) {
        list.innerHTML = '<p class="empty">Нет транзакций</p>';
        return;
    }

    let html = '';
    for (let i = 0; i < arr.length; i++) {
        const t     = arr[i];
        const color = t.type === 'income' ? 'green' : 'red';
        const sign  = t.type === 'income' ? '+' : '−';

        html += '<div class="item">';
        html += '  <div class="item-info">';
        html += '    <div class="date">' + formatDate(t.date) + '</div>';
        html += '    <div class="category">' + t.category + '</div>';
        if (t.comment) {
            html += '  <div class="comment">' + t.comment + '</div>';
        }
        html += '  </div>';
        html += '  <div class="item-amount ' + color + '">' + sign + ' ' + t.amount + ' ₽</div>';
        html += '  <div class="item-btns">';
        html += '    <button class="edit-btn" onclick="startEdit(' + t.id + ')">Изм.</button>';
        html += '    <button class="del-btn" onclick="deleteItem(' + t.id + ')">Удалить</button>';
        html += '  </div>';
        html += '</div>';
    }

    list.innerHTML = html;
}

// считаем статистику
function updateStats() {
    let balance = 0;
    let income  = 0;
    let expense = 0;

    const now      = new Date();
    const curMonth = now.getMonth();
    const curYear  = now.getFullYear();

    for (let i = 0; i < transactions.length; i++) {
        const t = transactions[i];
        const d = new Date(t.date);

        if (t.type === 'income') {
            balance += t.amount;
        } else {
            balance -= t.amount;
        }

        if (d.getMonth() === curMonth && d.getFullYear() === curYear) {
            if (t.type === 'income') {
                income += t.amount;
            } else {
                expense += t.amount;
            }
        }
    }

    document.getElementById('balance').textContent = balance + ' ₽';
    document.getElementById('income').textContent  = income  + ' ₽';
    document.getElementById('expense').textContent = expense + ' ₽';

    const balEl = document.getElementById('balance');
    if (balance > 0) {
        balEl.className = 'green';
    } else if (balance < 0) {
        balEl.className = 'red';
    } else {
        balEl.className = '';
    }
}

// экспорт в CSV
function exportCSV() {
    if (transactions.length === 0) {
        alert('Нет транзакций для экспорта');
        return;
    }

    let csv = 'Дата;Тип;Категория;Сумма;Комментарий\n';

    for (let i = 0; i < transactions.length; i++) {
        const t    = transactions[i];
        const type = t.type === 'income' ? 'Доход' : 'Расход';
        csv += formatDate(t.date) + ';' + type + ';' + t.category + ';' + t.amount + ';' + t.comment + '\n';
    }

    // создаём ссылку и кликаем по ней
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = 'transactions.csv';
    link.click();
    URL.revokeObjectURL(url);
}

// форматируем дату из 2026-05-16 в 16.05.2026
function formatDate(str) {
    const parts = str.split('-');
    return parts[2] + '.' + parts[1] + '.' + parts[0];
}

// первый запуск
render();
