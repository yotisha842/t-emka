// массив всех транзакций
let transactions = [];

// читаем из localStorage при загрузке
const saved = localStorage.getItem('transactions');
if (saved) {
    transactions = JSON.parse(saved);
}

// ставим текущую дату в поле даты
document.getElementById('date').value = new Date().toISOString().slice(0, 10);

// форма добавления
const form = document.getElementById('form');

form.addEventListener('submit', function(e) {
    e.preventDefault();

    // собираем данные из формы
    const type = document.getElementById('type').value;
    const amount = Number(document.getElementById('amount').value);
    const category = document.getElementById('category').value;
    const date = document.getElementById('date').value;
    const comment = document.getElementById('comment').value;

    if (amount <= 0) {
        alert('Сумма должна быть больше 0');
        return;
    }

    // создаём новый объект
    const newItem = {
        id: Date.now(),
        type: type,
        amount: amount,
        category: category,
        date: date,
        comment: comment
    };

    transactions.push(newItem);
    save();
    render();

    // очищаем форму
    document.getElementById('amount').value = '';
    document.getElementById('comment').value = '';
});

// сохраняем в localStorage
function save() {
    localStorage.setItem('transactions', JSON.stringify(transactions));
}

// удаление транзакции
function deleteItem(id) {
    transactions = transactions.filter(function(t) {
        return t.id !== id;
    });
    save();
    render();
}

// рисуем всё на странице
function render() {
    renderList();
    updateStats();
}

// список транзакций
function renderList() {
    const list = document.getElementById('list');

    if (transactions.length === 0) {
        list.innerHTML = '<p class="empty">Пока нет транзакций</p>';
        return;
    }

    // сортируем по дате - новые сверху
    const sorted = transactions.slice().sort(function(a, b) {
        return new Date(b.date) - new Date(a.date);
    });

    let html = '';
    for (let i = 0; i < sorted.length; i++) {
        const t = sorted[i];
        const color = t.type === 'income' ? 'green' : 'red';
        const sign = t.type === 'income' ? '+' : '−';

        html += '<div class="item">';
        html += '  <div class="item-info">';
        html += '    <div class="date">' + formatDate(t.date) + '</div>';
        html += '    <div class="category">' + t.category + '</div>';
        if (t.comment) {
            html += '    <div class="comment">' + t.comment + '</div>';
        }
        html += '  </div>';
        html += '  <div class="item-amount ' + color + '">' + sign + ' ' + t.amount + ' ₽</div>';
        html += '  <button class="del-btn" onclick="deleteItem(' + t.id + ')">Удалить</button>';
        html += '</div>';
    }

    list.innerHTML = html;
}

// считаем баланс, доходы и расходы за месяц
function updateStats() {
    let income = 0;
    let expense = 0;
    let balance = 0;

    // текущий месяц и год
    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();

    for (let i = 0; i < transactions.length; i++) {
        const t = transactions[i];
        const d = new Date(t.date);

        // баланс - считаем все транзакции
        if (t.type === 'income') {
            balance += t.amount;
        } else {
            balance -= t.amount;
        }

        // месячные - только за текущий месяц
        if (d.getMonth() === curMonth && d.getFullYear() === curYear) {
            if (t.type === 'income') {
                income += t.amount;
            } else {
                expense += t.amount;
            }
        }
    }

    document.getElementById('balance').textContent = balance + ' ₽';
    document.getElementById('income').textContent = income + ' ₽';
    document.getElementById('expense').textContent = expense + ' ₽';

    // подкрашиваем баланс
    const balEl = document.getElementById('balance');
    if (balance > 0) {
        balEl.className = 'green';
    } else if (balance < 0) {
        balEl.className = 'red';
    } else {
        balEl.className = '';
    }
}

// форматируем дату из 2026-05-16 в 16.05.2026
function formatDate(str) {
    const parts = str.split('-');
    return parts[2] + '.' + parts[1] + '.' + parts[0];
}

// первый запуск
render();
