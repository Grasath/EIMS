let pool;
async function main(){
    const mysql = require('mysql2');
    const dotenv = require('dotenv');
    dotenv.config();
    pool = mysql.createPool({
        host: process.env.mysql_host,
        user: process.env.mysql_user,
        password: process.env.mysql_password,
        database: process.env.mysql_database,
        port : process.env.mysql_port,
        connectTimeout: 30000
    }).promise();
}

main();


const MAX_RETRIES = 3;
let retries = 0;

async function connectToDatabase() {
  try {
    await pool.query('SELECT 1'); // Test the connection
    console.log('Connected to the database!');
  } catch (error) {
    if (retries < MAX_RETRIES) {
      retries++;
      console.error('Connection failed. Retrying...');
      setTimeout(connectToDatabase, 5000); // Retry after 5 seconds
    } else {
      console.error('Max retries reached. Unable to connect to the database.');
    }
  }
}

connectToDatabase();

module.exports.count = async()=>{
    const [e_count] = await pool.query(
        `SELECT 
        COUNT(e.emp_no) AS emp_count
    FROM
        employees e
            JOIN
        dept_emp de ON e.emp_no = de.emp_no
            JOIN
        departments d ON d.dept_no = de.dept_no
            JOIN
        salaries s ON s.emp_no = e.emp_no
            AND de.to_date = s.to_date
            JOIN
        titles t ON t.emp_no = e.emp_no
            AND de.to_date = t.to_date
            AND t.to_date > SYSDATE();`
    );

    const [m_count] = await pool.query(
        `select count(emp_no) as man_count from dept_manager`
    );

    const result = {
        eCount : e_count[0].emp_count,
        mCount : m_count[0].man_count
    }
    return result;
}

module.exports.newEmployee = async (dob,firstName,lastName,gender,deptName,fromDate,toDate,title,salary)=>{
    const [emp_no] = await pool.query(`
        SELECT 
            MAX(e.emp_no) + 1 AS emp_no
        FROM
            (SELECT 
                emp_no
            FROM
                employees UNION SELECT 
                emp_no
            FROM
                employees_backup) AS e;
    `);
    const empNo = emp_no[0].emp_no;
    const [dept_no]= await pool.query(`(select dept_no from departments where dept_name = ?)`,[deptName]);
    const deptNo = dept_no[0].dept_no;
    const [employees] = await pool.query(`
        insert into employees(emp_no,birth_date,first_name,last_name,gender,hire_date)
        values(?,?,?,?,?,date_format(sysdate(),'%y-%m-%d'));`,[empNo,dob,firstName,lastName,gender]);
    const [dept_emp] = await pool.query(`
        insert into dept_emp 
        values (?,?,?,?);
    `,[empNo,deptNo,fromDate,toDate]);
    if (title == 'Manager'){
        const [dept_manager] = await pool.query(`
            insert into dept_manager 
            values (?,?,?,?);
            `,[empNo,deptNo,fromDate,toDate]
        );

    }
    const [salaries] = await pool.query(`
    insert into salaries 
    values (?,?,?,?);
    `,[empNo,salary,fromDate,toDate]
    );

    const [titles] = await pool.query(`
    insert into titles 
    values (?,?,?,?);
    `,[empNo,title,fromDate,toDate]
    );
}

module.exports.allEmployees = async()=>{
    const [result] = await pool.query('CALL all_employee_list()');
    return result[0];
}

module.exports.filterEmployees = async(emp_num,dept_condition,title_condition,gender_condition,min_value,max_value)=>{
    const [result] = await pool.query(`
    SELECT 
    e.emp_no,
    e.first_name,
    e.last_name,
    CASE
        WHEN e.gender = 'm' THEN 'Male'
        ELSE 'Female'
    END AS gender,
    concat(day(e.birth_date),'-',month(e.birth_date),'-',year(e.birth_date)) AS birth_date,
    concat(day(e.hire_date),'-',month(e.hire_date),'-',year(e.hire_date)) AS hire_date,
    t.title,
    dept_name,
    CONCAT('$', ROUND(s.salary, 2)) AS salary,
    concat(day(de.from_date),'-',month(de.from_date),'-',year(de.from_date)) as from_date,
    concat(day(de.to_date),'-',month(de.to_date),'-',year(de.to_date)) as to_date
FROM
    employees e
        JOIN
    dept_emp de ON e.emp_no = de.emp_no
        JOIN
    departments d ON d.dept_no = de.dept_no
        JOIN
    salaries s ON s.emp_no = e.emp_no
        AND de.to_date = s.to_date
        JOIN
    titles t ON t.emp_no = e.emp_no
        AND de.to_date = t.to_date and t.to_date > SYSDATE()
    where e.emp_no = ${emp_num} or (dept_name in (${dept_condition}) and t.title in (${title_condition}) and e.gender in (${gender_condition})
    and (s.salary >= ${min_value} and s.salary <= ${max_value}))
    order by e.emp_no desc
    limit 1000;
    `);
   
    return result;

}

module.exports.selectForUpdate = async(emp_no)=>{
    const [result] = await pool.query(`CALL select_employee_for_update(${emp_no});`);

    return result[0];
}

module.exports.updateEmployee = async (emp_no,first_name,last_name,gender,dob,dept,title,salary,from_date,to_date)=>{
    const [result] = await pool.query(`
        CALL update_employee(?,?,?,?,?,?,?,?,?,?);
    `,[emp_no,first_name,last_name,gender,dob,dept,title,salary,from_date,to_date]);
}


module.exports.deleteEmployee = async (emp_no)=>{
    const [result] = await pool.query(`
        CALL delete_single_record(${emp_no});
    `)
}

module.exports.deleteAllEmployees = async(dept_condition,title_condition,gender_condition,min_value,max_value,from_date,to_date)=>{
    const [dept_no] = await pool.query(`select dept_no from departments where dept_name in (${dept_condition});`)
    const deptNoList =[];
    const empNoList = [];
    dept_no.forEach(num=>{
        deptNoList.push(num.dept_no);
    })
    const conditionCheck = async(input)=>{
        let condition = '';
        if (input){
             condition = "'"+input.join("','")+"'";
        }else{
            condition = "'none'";
        }
        return condition;
    }
    const dept_no_condition = await conditionCheck(deptNoList); 
    const [emp_no] = await pool.query(`
        SELECT 
            e.emp_no as emp_no
        FROM
            employees e
                JOIN
            dept_emp de ON e.emp_no = de.emp_no
                JOIN
            departments d ON d.dept_no = de.dept_no
                JOIN
            salaries s ON s.emp_no = e.emp_no
                AND de.to_date = s.to_date
                JOIN
            titles t ON t.emp_no = e.emp_no
                AND de.to_date = t.to_date
        WHERE
            de.dept_no IN (${dept_no_condition})
                AND de.from_date >= '${from_date}'
                AND de.to_date <= '${to_date}'
                AND s.salary >= ${min_value}
                AND s.salary <= ${max_value}
                AND t.title IN (${title_condition})
                AND e.gender IN (${gender_condition});
    `);

    emp_no.forEach(num=>{
        empNoList.push(num.emp_no)
    })
    const emp_no_condition = await conditionCheck(empNoList);

    const [del_dept_manager]= await pool.query(`
        DELETE FROM dept_manager 
        WHERE
            emp_no IN (${emp_no_condition});`
    )
    
    const [del_salaries]= await pool.query(`
        DELETE FROM salaries
        WHERE
            emp_no IN (${emp_no_condition});`
    )        
    
    const [del_titles]= await pool.query(`
        DELETE FROM titles
        WHERE
            emp_no IN (${emp_no_condition});`
    )            
    
            
    const [del_dept_emp]= await pool.query(`
        DELETE FROM dept_emp
        WHERE
            emp_no IN (${emp_no_condition});`
    )    
            
    const [del_employees]= await pool.query(`
        DELETE FROM employees
        WHERE
            emp_no IN (${emp_no_condition});`
    )    
            
       
}

module.exports.minMaxSalary = async()=>{
    const [minSalary] = await pool.query(`select min(salary) as min from salaries;`);
    const [maxSalary] = await pool.query(`select max(salary) as max from salaries;`);
    const salary = {
        min : minSalary[0].min,
        max : maxSalary[0].max
    };

    return salary;
    
}

module.exports.fromToDate = async()=>{
    const [minFromDate] = await pool.query(`select min(from_date) as fromDate from dept_emp;`);
    const [maxToDate] = await pool.query(`select max(to_date) as toDate from dept_emp;`);

    const date = {
        fromDate : minFromDate[0].fromDate,
        toDate : maxToDate[0].toDate
    }

    return date;
}

module.exports.retrive = async(emp_no)=>{
    const [result] = await pool.query(`
        CALL retrive(${emp_no})
    `);
}

module.exports.retriveAll = async ()=>{
    const [result] = await pool.query(
        `CALL retrive_all()`
    )
}

module.exports.recycleBinView = async()=>{
    const [result] = await pool.query(
        `CALL recycle_bin_list()`
    )

    return result[0];
}

module.exports.recycleBinDelete = async(emp_no)=>{
    const [result] = await pool.query(
        `CALL recycle_bin_delete(${emp_no})`
    )
}

module.exports.recycleBinDeleteAll = async()=>{
    const [result] = await pool.query(
        `CALL recycle_bin_delete_all()`
    )
}
