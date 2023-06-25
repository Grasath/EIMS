const express = require('express');
const bodyParser = require('body-parser');
const {newEmployee,allEmployees,filterEmployees,selectForUpdate,updateEmployee,deleteEmployee,minMaxSalary,deleteAllEmployees,retrive,retriveAll,recycleBinView,recycleBinDelete,recycleBinDeleteAll,count} = require('./database.js');
const ejs = require('ejs');
const app = express();
const dotenv = require('dotenv')
const  port = process.env.port;

let allInfoList = [];


const allInfo = async()=>{
    const results = await allEmployees();
    results.forEach(result =>{
        allInfoList.push(result);
    });
} 
allInfo();

const conditionCheck = async(input)=>{
    let condition = '';
    if (input){
         condition = "'"+input.join("','")+"'";
    }else{
        condition = "'none'";
    }
    return condition;
}



app.use(express.static('public'));
app.use(bodyParser.urlencoded({extended:true}));

app.set('view engine', 'ejs');
app.set('views',`${__dirname}/views`);


app.get('/', async(req,res)=>{
    const countAll = await count();
    res.render('index',{eCount : countAll.eCount, mCount : countAll.mCount});
})
app.post('/employeeTableFilter',async(req,res)=>{
    const department = await req.body.department;
    const title  = await req.body.title;
    const gender = await req.body.gender;
    const min_value = await req.body.min_value;
    const max_value = await req.body.max_value;
    const emp_num = await req.body.emp_no;
    const salary = await minMaxSalary();
    const dept_condition = await conditionCheck(department);
    const title_condition  = await conditionCheck(title);
    const gender_condition = await conditionCheck(gender);  
    let filterInfoList = [];
    const filterInfo = async ()=>{
        const results = await filterEmployees(
            emp_num || 0,dept_condition,title_condition,gender_condition,min_value || salary.min ,max_value|| salary.max
        );
        results.forEach(result =>{
            filterInfoList.push(result);
        });
    }
    await filterInfo();
    
    res.render('employeeTable',{infoList : filterInfoList});
})

app.get('/newemployee',(req,res)=>{
    res.render('newEmployee');
})
app.post('/success',async(req,res)=>{
    // const allInfo = await allEmployees();   
    const birth_date = await req.body.dob;
    const firstName = await req.body.firstName;
    const lastName = await req.body.lastName;
    const gender = await req.body.gender; 
    const deptName = await req.body.deptName;
    const title = await req.body.title;
    const salary = await req.body.salary;
    const fromDate = await req.body.fromDate;
    const toDate = await req.body.toDate;
    await newEmployee(birth_date,firstName,lastName,gender,deptName,fromDate,toDate,title,salary);
    allInfoList = [];
    await allInfo();
    res.redirect('/employeeinfo')
})

app.post('/newRecord',async(req,res)=>{
    // const allInfo = await allEmployees();   
    const birth_date = await req.body.dob;
    const firstName = await req.body.firstName;
    const lastName = await req.body.lastName;
    const gender = await req.body.gender; 
    const deptName = await req.body.deptName;
    const title = await req.body.title;
    const salary = await req.body.salary;
    const fromDate = await req.body.fromDate;
    const toDate = await req.body.toDate;
    await newEmployee(birth_date,firstName,lastName,gender,deptName,fromDate,toDate,title,salary);
    allInfoList = [];
    await allInfo();
    res.redirect('/')
})


app.get('/employeeinfo',async (req,res)=>{
    const salary = await minMaxSalary();
    res.render('employeeinfo',{min_value:salary.min,max_value:salary.max})
})


app.get('/employeeTable',async(req,res)=>{
    allInfoList = [];
    await allInfo();
    res.render('employeeTable',{infoList : allInfoList});
})

app.get('/dashboard',async (req,res)=>{
    res.render('dashboard')
})

app.post('/updateemployee',async (req,res)=>{
    const emp_no = await req.body.emp_no;
    const [result] = await selectForUpdate(emp_no);
    res.render('updateEmployee',{
        empNum : result.emp_no,
        firstName : result.first_name,
        lastName : result.last_name,
        gender : result.gender,
        birthDate : result.birth_date,
        hireDate :result.hire_date,
        title : result.title,
        deptName : result.dept_name,
        salary : result.salary,
        fromDate : result.from_date,
        toDate : result.to_date
    })
})

app.post('/updated',async(req,res)=>{
    const result = req.body;
    console.log(result);
    await updateEmployee(
        result.emp_no,
        result.firstName,
        result.lastName,
        result.gender,
        result.dob,
        result.deptName,
        result.title,
        result.salary,
        result.fromDate,
        result.toDate
    )
    res.render('index');
})

app.post('/delete',async(req,res)=>{
    const emp_no = req.body.emp_no;
    await deleteEmployee(emp_no);
    res.redirect('/employeeinfo')
})

app.get('/deleteEmployee',(req,res)=>{
    res.render('deleteEmployee');
})

app.post('/deleteall',async(req,res)=>{
    const department = await req.body.department;
    const title  = await req.body.title;
    const gender = await req.body.gender;
    const min_value = await req.body.min_value;
    const max_value = await req.body.max_value;
    const from_date = await req.body.from_date;
    const to_date = await req.body.to_date;
    const dept_condition = await conditionCheck(department);
    const title_condition  = await conditionCheck(title);
    const gender_condition = await conditionCheck(gender);
    const salary = await minMaxSalary();
    const date = await fromToDate();
    await deleteAllEmployees(
        dept_condition,title_condition,gender_condition,min_value||salary.min,max_value||salary.max,from_date||date.fromDate,to_date||date.toDate
    )
    res.render('index')
})

app.get('/recycleBinView', async(req,res)=>{
    const recycleBinList = [];
    const results = await recycleBinView();
    results.forEach(result=>{
        recycleBinList.push(result)
    });
    res.render('employeeTable',{infoList:recycleBinList})
})

app.post('/retrive',async(req,res)=>{
    const emp_no = await req.body.emp_no;
    await retrive(emp_no);
    res.redirect('/employeeinfo')
})

app.get('/retriveAll',async(req,res)=>{
    await retriveAll();
    res.redirect('/employeeinfo');
})

app.post('/recycleBinDelete',async(req,res)=>{
    const emp_no = await req.body.emp_no;
    await recycleBinDelete(emp_no);
    res.redirect('/employeeinfo');
})

app.get('/recycleBinDeleteAll',async(req,res)=>{
    await recycleBinDeleteAll();
    res.redirect('employeeinfo');
})

app.listen(port,()=>{
    
    console.log(`Server is starting on ${port}`);
})