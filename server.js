

const http = require('http');
const mysql = require('mysql');

const cors = require('cors');
const path = require('path');
const express = require('express');
const bodyParser = require("body-parser");
const app = express();
//połączenie z bazą danych
const port = 3333;

const sql = mysql.createConnection({
    host: 'db4free.net',
    user: 'projektfv',
    password: 'Zadanie12',
    database: 'projektfv12',
});

sql.connect((err) => {
    if (err) console.log(err);
    else console.log('sql connected');
});

function abortIfNeeded(res, err) {
    if (err) {
        res.send(err);
        throw err;
    }
}

const flatten = list => list.reduce(
    (a, b) => a.concat(Array.isArray(b) ? flatten(b) : b), []
);

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());
app.options('*', cors());
app.use('/static', express.static(path.join(__dirname, 'public')))
//pobranie materiałów z bazy 
app.get('/materials', (req, res) => {
    const command = 'SELECT * FROM `materialy`';
    sql.query(command, (err, result) => {
        abortIfNeeded(res, err);
        res.json(result);
    });
});
//wprowadzanie materiałów do bazy
app.put('/materials', (req, res) => {
    const command = 'INSERT INTO `materialy`(`nazwa_materialu`, `cena_materialu`, `vat_materialu`) VALUES (?, ?, ?)';
    const args = [req.body.name, req.body.price, req.body.tax];
    console.log(args);
    sql.query(command, args, (err, result) => {
        abortIfNeeded(res, err);
        res.sendStatus(200);
    });
});
//przypisywanie materiałów do danej faktury
app.put('/invoices', (req, res) => {
    const createInvoiceMaterialMapping = (id_faktury) => {
        const command = 'INSERT INTO `materialy_faktury`(`id_faktury`, `id_materialu`, `ilosc`) VALUES ';

        const records = [];
        Object.keys(req.body).forEach(function(key) {
            if (key.startsWith('material-')) {
                records.push([id_faktury, +key.replace('material-', ''), +req.body[key]]);
            }
        });

        sql.query(command + [...records].fill('(?, ?, ?)').join(','), flatten(records), (err, result) => {
            abortIfNeeded(res, err);
            res.sendStatus(200);
        });
    };
// dodawanie danych klienta, terminów, numerów nip do bazy danych 
    const createInvoice = (thenF) => {
        const command = 'INSERT INTO `faktury`(`nr_faktury`, `wystawiajacy_faktury`, `wystawiajacy_nazwa`, `nabywca_faktury`, `nabywca_nazwa`, `data_faktury`, `numer_konta`, `termin`) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
        const args = [req.body.nr, req.body.seller, req.body.seller1, req.body.buyer, req.body.buyer1, req.body.date, req.body.count, req.body.date1];
        console.log(args);
        sql.query(command, args, (err, result) => {
            abortIfNeeded(res, err);
            thenF(result.insertId);
        });
    }

    createInvoice(createInvoiceMaterialMapping);
});
//wyświetlanie materiałów z bazy danych
app.get('/invoices/:invoiceId/materials', (req, res) => {
    const command = 'SELECT * FROM `materialy_faktury` WHERE `id_faktury` = ?';
    const args = [req.params.invoiceId];
    sql.query(command, args, (err, result) => {
        abortIfNeeded(res, err);
        res.json(result);
    });
});
// wyszukiwanie faktur
app.get('/invoices', (req, res) => {
    const query = {
        string: 'SELECT * FROM `faktury`',
        args: []
    };

    const addWhere = (query, name, data, operator) => {
        query.string += ` ${query.args.length === 0? 'WHERE' : 'AND'} `;
        query.string += `${name} ${operator} ?`;
        query.args.push(data);
    }
//sortowanie po nipie wystawiającego
    if (req.query.seller) {
        addWhere(query, 'wystawiajacy_faktury', req.query.seller, '=');
    }
//sortowanie po nipie nabywcy
    if (req.query.buyer) {
        addWhere(query, 'nabywca_faktury', req.query.buyer, '=');
    }
//sortowanie w przedziale dat
    if (req.query.date_min) {
        addWhere(query, 'data_faktury', req.query.date_min, '>=');
    }

    if (req.query.date_max) {
        addWhere(query, 'data_faktury', req.query.date_max, '<=');
    }

    console.log(query.string, query.args);
    sql.query(query.string, query.args, (err, result) => {
        abortIfNeeded(res, err);
        res.json(result);
    });
});

app.listen(port, () => console.log(`Server listening on ${port}!`));