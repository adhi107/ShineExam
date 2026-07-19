// Shine Exam sample question paper data for local interface checks.
export const sampleTest = {
  testName: "SAP Certified Technology Associate - SAP HANA Cloud Provisioning and Administration",
  certificationCode: "C_HCADM_01",
  duration: 180, // minutes
  questions: [
    {
      id: "1",
      type: "multiple" as const,
      question: "Which file formats can you use to import data into an SAP HANA Cloud database instance when using the SAP HANA database explorer?",
      options: ["CSV", "Binary", "Parquet", "JSON"],
      correctAnswer: ["CSV", "Parquet"],
      section: "SAP HANA Cloud Basics",
      marks: 1,
      note: "Note: There are 2 correct answers to this question."
    },
    {
      id: "2",
      type: "mcq" as const,
      question: "What is the primary purpose of SAP HANA Cloud?",
      options: ["Data warehousing only", "In-memory database platform", "File storage", "Email service"],
      correctAnswer: "In-memory database platform",
      section: "SAP HANA Cloud Basics",
      marks: 1
    },
    {
      id: "3",
      type: "multiple" as const,
      question: "Which deployment options are available for SAP HANA Cloud?",
      options: ["Multi-tenant", "Single-tenant", "Hybrid", "On-premises only"],
      correctAnswer: ["Multi-tenant", "Single-tenant"],
      section: "SAP HANA Cloud Basics",
      marks: 1,
      note: "Note: There are 2 correct answers to this question."
    },
    {
      id: "4",
      type: "mcq" as const,
      question: "Which tool is used for administering SAP HANA Cloud instances?",
      options: ["SAP HANA Cockpit", "SAP Cloud Platform", "SAP HANA Studio", "SAP BTP Cockpit"],
      correctAnswer: "SAP BTP Cockpit",
      section: "SAP HANA Cloud Basics",
      marks: 1
    },
    {
      id: "5",
      type: "multiple" as const,
      question: "What are the key features of SAP HANA Cloud?",
      options: ["In-memory processing", "Real-time analytics", "Blockchain support", "Multi-model processing"],
      correctAnswer: ["In-memory processing", "Real-time analytics", "Multi-model processing"],
      section: "SAP HANA Cloud Basics",
      marks: 1,
      note: "Note: There are 3 correct answers to this question."
    },
    {
      id: "6",
      type: "mcq" as const,
      question: "What type of database is SAP HANA primarily?",
      options: ["NoSQL", "Relational", "Graph", "Document"],
      correctAnswer: "Relational",
      section: "SAP HANA Cloud Basics",
      marks: 1
    },
    {
      id: "7",
      type: "multiple" as const,
      question: "Which programming languages are supported for application development in SAP HANA Cloud?",
      options: ["SQLScript", "Node.js", "Python", "Ruby"],
      correctAnswer: ["SQLScript", "Node.js", "Python"],
      section: "SAP HANA Cloud Basics",
      marks: 1,
      note: "Note: There are 3 correct answers to this question."
    },
    {
      id: "8",
      type: "mcq" as const,
      question: "What is the default port for SAP HANA database connections?",
      options: ["3306", "30013", "1433", "5432"],
      correctAnswer: "30013",
      section: "SAP HANA Cloud Basics",
      marks: 1
    },
    {
      id: "9",
      type: "multiple" as const,
      question: "Which storage types does SAP HANA Cloud support?",
      options: ["Column store", "Row store", "Document store", "Key-value store"],
      correctAnswer: ["Column store", "Row store"],
      section: "SAP HANA Cloud Basics",
      marks: 1,
      note: "Note: There are 2 correct answers to this question."
    },
    {
      id: "10",
      type: "mcq" as const,
      question: "What is the minimum memory size for an SAP HANA Cloud instance?",
      options: ["8 GB", "16 GB", "32 GB", "64 GB"],
      correctAnswer: "32 GB",
      section: "SAP HANA Cloud Basics",
      marks: 1
    },
    {
      id: "11",
      type: "multiple" as const,
      question: "Which services are part of SAP HANA Cloud?",
      options: ["SAP HANA Database", "SAP Data Warehouse Cloud", "SAP HANA Data Lake", "SAP Analytics Cloud"],
      correctAnswer: ["SAP HANA Database", "SAP HANA Data Lake"],
      section: "Architecture",
      marks: 1,
      note: "Note: There are 2 correct answers to this question."
    },
    {
      id: "12",
      type: "mcq" as const,
      question: "What is the purpose of the persistence layer in SAP HANA?",
      options: ["Store data in memory only", "Store data on disk for recovery", "Cache frequently used data", "Compress data automatically"],
      correctAnswer: "Store data on disk for recovery",
      section: "Architecture",
      marks: 1
    },
    {
      id: "13",
      type: "multiple" as const,
      question: "Which components are part of the SAP HANA architecture?",
      options: ["Index server", "Name server", "Preprocessor server", "Statistics server"],
      correctAnswer: ["Index server", "Name server", "Statistics server"],
      section: "Architecture",
      marks: 1,
      note: "Note: There are 3 correct answers to this question."
    },
    {
      id: "14",
      type: "mcq" as const,
      question: "What does the index server in SAP HANA primarily handle?",
      options: ["Metadata management", "Data processing and storage", "Network routing", "User authentication"],
      correctAnswer: "Data processing and storage",
      section: "Architecture",
      marks: 1
    },
    {
      id: "15",
      type: "multiple" as const,
      question: "Which security features are available in SAP HANA Cloud?",
      options: ["Data encryption at rest", "Data encryption in transit", "Biometric authentication", "Role-based access control"],
      correctAnswer: ["Data encryption at rest", "Data encryption in transit", "Role-based access control"],
      section: "Architecture",
      marks: 1,
      note: "Note: There are 3 correct answers to this question."
    },
    {
      id: "16",
      type: "mcq" as const,
      question: "What is the purpose of savepoints in SAP HANA?",
      options: ["Create backups", "Ensure data consistency", "Optimize queries", "Monitor performance"],
      correctAnswer: "Ensure data consistency",
      section: "Architecture",
      marks: 1
    },
    {
      id: "17",
      type: "multiple" as const,
      question: "Which data modeling views are available in SAP HANA?",
      options: ["Attribute views", "Analytic views", "Calculation views", "Hierarchical views"],
      correctAnswer: ["Attribute views", "Analytic views", "Calculation views"],
      section: "Architecture",
      marks: 1,
      note: "Note: There are 3 correct answers to this question."
    },
    {
      id: "18",
      type: "mcq" as const,
      question: "What is the recommended backup strategy for SAP HANA Cloud?",
      options: ["Manual backups only", "Automated regular backups", "No backups needed", "Yearly backups"],
      correctAnswer: "Automated regular backups",
      section: "Architecture",
      marks: 1
    },
    {
      id: "19",
      type: "multiple" as const,
      question: "Which monitoring tools can be used for SAP HANA Cloud?",
      options: ["SAP HANA Cockpit", "Database Explorer", "SAP Solution Manager", "Cloud Foundry CLI"],
      correctAnswer: ["SAP HANA Cockpit", "Database Explorer"],
      section: "Architecture",
      marks: 1,
      note: "Note: There are 2 correct answers to this question."
    },
    {
      id: "20",
      type: "mcq" as const,
      question: "What is the purpose of table partitioning in SAP HANA?",
      options: ["Reduce memory usage", "Improve query performance", "Encrypt data", "Create backups"],
      correctAnswer: "Improve query performance",
      section: "Architecture",
      marks: 1
    },
    {
      id: "21",
      type: "multiple" as const,
      question: "Which user types exist in SAP HANA Cloud?",
      options: ["Standard users", "System users", "Guest users", "Restricted users"],
      correctAnswer: ["Standard users", "System users", "Restricted users"],
      section: "Security",
      marks: 1,
      note: "Note: There are 3 correct answers to this question."
    },
    {
      id: "22",
      type: "mcq" as const,
      question: "What is the default authentication method for SAP HANA Cloud?",
      options: ["Basic authentication", "SAML", "OAuth 2.0", "Kerberos"],
      correctAnswer: "SAML",
      section: "Security",
      marks: 1
    },
    {
      id: "23",
      type: "multiple" as const,
      question: "Which privileges can be granted to users in SAP HANA?",
      options: ["System privileges", "Object privileges", "Schema privileges", "Network privileges"],
      correctAnswer: ["System privileges", "Object privileges"],
      section: "Security",
      marks: 1,
      note: "Note: There are 2 correct answers to this question."
    },
    {
      id: "24",
      type: "mcq" as const,
      question: "What is the purpose of roles in SAP HANA security?",
      options: ["Group privileges for users", "Encrypt data", "Monitor performance", "Create backups"],
      correctAnswer: "Group privileges for users",
      section: "Security",
      marks: 1
    },
    {
      id: "25",
      type: "multiple" as const,
      question: "Which encryption methods are supported in SAP HANA Cloud?",
      options: ["TLS/SSL", "AES-256", "RSA", "MD5"],
      correctAnswer: ["TLS/SSL", "AES-256"],
      section: "Security",
      marks: 1,
      note: "Note: There are 2 correct answers to this question."
    },
    {
      id: "26",
      type: "mcq" as const,
      question: "How can you audit user activities in SAP HANA Cloud?",
      options: ["Enable audit logging", "Monitor network traffic", "Review backup logs", "Check error logs"],
      correctAnswer: "Enable audit logging",
      section: "Security",
      marks: 1
    },
    {
      id: "27",
      type: "multiple" as const,
      question: "Which identity providers can be integrated with SAP HANA Cloud?",
      options: ["Azure AD", "SAP Identity Service", "Google Identity", "AWS Cognito"],
      correctAnswer: ["Azure AD", "SAP Identity Service"],
      section: "Security",
      marks: 1,
      note: "Note: There are 2 correct answers to this question."
    },
    {
      id: "28",
      type: "mcq" as const,
      question: "What is the recommended password policy for SAP HANA users?",
      options: ["No password required", "Simple passwords allowed", "Complex passwords with regular rotation", "Default passwords for all users"],
      correctAnswer: "Complex passwords with regular rotation",
      section: "Security",
      marks: 1
    },
    {
      id: "29",
      type: "multiple" as const,
      question: "Which security best practices should be followed for SAP HANA Cloud?",
      options: ["Regular security patches", "Principle of least privilege", "Public access to all data", "Disable encryption"],
      correctAnswer: ["Regular security patches", "Principle of least privilege"],
      section: "Security",
      marks: 1,
      note: "Note: There are 2 correct answers to this question."
    },
    {
      id: "30",
      type: "mcq" as const,
      question: "What is the purpose of data masking in SAP HANA?",
      options: ["Improve performance", "Protect sensitive data", "Reduce storage", "Encrypt backups"],
      correctAnswer: "Protect sensitive data",
      section: "Security",
      marks: 1
    },
    {
      id: "31",
      type: "multiple" as const,
      question: "Which backup types are available in SAP HANA Cloud?",
      options: ["Full backup", "Incremental backup", "Differential backup", "Snapshot backup"],
      correctAnswer: ["Full backup", "Incremental backup", "Differential backup"],
      section: "Backup and Recovery",
      marks: 1,
      note: "Note: There are 3 correct answers to this question."
    },
    {
      id: "32",
      type: "mcq" as const,
      question: "How often should full backups be performed in production?",
      options: ["Hourly", "Daily", "Weekly", "Monthly"],
      correctAnswer: "Daily",
      section: "Backup and Recovery",
      marks: 1
    },
    {
      id: "33",
      type: "multiple" as const,
      question: "What should be verified after a backup completes?",
      options: ["Backup size", "Backup status", "Memory usage", "Backup logs"],
      correctAnswer: ["Backup size", "Backup status", "Backup logs"],
      section: "Backup and Recovery",
      marks: 1,
      note: "Note: There are 3 correct answers to this question."
    },
    {
      id: "34",
      type: "mcq" as const,
      question: "Where are SAP HANA Cloud backups stored?",
      options: ["Local disk only", "Cloud storage", "External hard drive", "Memory"],
      correctAnswer: "Cloud storage",
      section: "Backup and Recovery",
      marks: 1
    },
    {
      id: "35",
      type: "multiple" as const,
      question: "Which recovery options are available in SAP HANA Cloud?",
      options: ["Point-in-time recovery", "Complete recovery", "Partial recovery", "Table-level recovery"],
      correctAnswer: ["Point-in-time recovery", "Complete recovery"],
      section: "Backup and Recovery",
      marks: 1,
      note: "Note: There are 2 correct answers to this question."
    },
    {
      id: "36",
      type: "mcq" as const,
      question: "What is the retention period for automated backups in SAP HANA Cloud?",
      options: ["7 days", "14 days", "30 days", "90 days"],
      correctAnswer: "14 days",
      section: "Backup and Recovery",
      marks: 1
    },
    {
      id: "37",
      type: "multiple" as const,
      question: "Which factors affect backup duration?",
      options: ["Database size", "Network bandwidth", "CPU usage", "Number of users"],
      correctAnswer: ["Database size", "Network bandwidth"],
      section: "Backup and Recovery",
      marks: 1,
      note: "Note: There are 2 correct answers to this question."
    },
    {
      id: "38",
      type: "mcq" as const,
      question: "What happens if a backup fails?",
      options: ["Database shuts down", "Alert notification sent", "Automatic retry", "Data is lost"],
      correctAnswer: "Alert notification sent",
      section: "Backup and Recovery",
      marks: 1
    },
    {
      id: "39",
      type: "multiple" as const,
      question: "What should be tested regularly for disaster recovery?",
      options: ["Backup restoration", "Failover procedures", "Data encryption", "Backup deletion"],
      correctAnswer: ["Backup restoration", "Failover procedures"],
      section: "Backup and Recovery",
      marks: 1,
      note: "Note: There are 2 correct answers to this question."
    },
    {
      id: "40",
      type: "mcq" as const,
      question: "Which tool is used to initiate manual backups in SAP HANA Cloud?",
      options: ["SAP HANA Studio", "BTP Cockpit", "Command line only", "Email request"],
      correctAnswer: "BTP Cockpit",
      section: "Backup and Recovery",
      marks: 1
    },
    {
      id: "41",
      type: "multiple" as const,
      question: "Which performance metrics should be monitored in SAP HANA Cloud?",
      options: ["Memory usage", "CPU utilization", "Disk space", "Network latency"],
      correctAnswer: ["Memory usage", "CPU utilization", "Disk space"],
      section: "Performance Optimization",
      marks: 1,
      note: "Note: There are 3 correct answers to this question."
    },
    {
      id: "42",
      type: "mcq" as const,
      question: "What is the primary cause of slow query performance?",
      options: ["Missing indexes", "Too many users", "Large memory", "Fast network"],
      correctAnswer: "Missing indexes",
      section: "Performance Optimization",
      marks: 1
    },
    {
      id: "43",
      type: "multiple" as const,
      question: "Which techniques improve query performance in SAP HANA?",
      options: ["Table partitioning", "Column store tables", "Regular backups", "Data compression"],
      correctAnswer: ["Table partitioning", "Column store tables", "Data compression"],
      section: "Performance Optimization",
      marks: 1,
      note: "Note: There are 3 correct answers to this question."
    },
    {
      id: "44",
      type: "mcq" as const,
      question: "What tool analyzes SQL query performance in SAP HANA?",
      options: ["SQL Analyzer", "Plan Visualizer", "Query Monitor", "Performance Inspector"],
      correctAnswer: "Plan Visualizer",
      section: "Performance Optimization",
      marks: 1
    },
    {
      id: "45",
      type: "multiple" as const,
      question: "What actions can reduce memory consumption in SAP HANA?",
      options: ["Data compression", "Remove unused tables", "Increase users", "Disable backups"],
      correctAnswer: ["Data compression", "Remove unused tables"],
      section: "Performance Optimization",
      marks: 1,
      note: "Note: There are 2 correct answers to this question."
    },
    {
      id: "46",
      type: "mcq" as const,
      question: "When should you consider scaling up an SAP HANA Cloud instance?",
      options: ["Low memory usage", "Consistently high memory usage", "Few active users", "Small database size"],
      correctAnswer: "Consistently high memory usage",
      section: "Performance Optimization",
      marks: 1
    },
    {
      id: "47",
      type: "multiple" as const,
      question: "Which factors impact data loading performance?",
      options: ["File format", "Data volume", "Network speed", "User permissions"],
      correctAnswer: ["File format", "Data volume", "Network speed"],
      section: "Performance Optimization",
      marks: 1,
      note: "Note: There are 3 correct answers to this question."
    },
    {
      id: "48",
      type: "mcq" as const,
      question: "What is the benefit of using calculation views?",
      options: ["Slower queries", "Optimized data access", "Increased storage", "Reduced security"],
      correctAnswer: "Optimized data access",
      section: "Performance Optimization",
      marks: 1
    },
    {
      id: "49",
      type: "multiple" as const,
      question: "Which statements about delta merge operations are correct?",
      options: ["Improves query performance", "Consolidates delta storage", "Runs automatically", "Deletes all data"],
      correctAnswer: ["Improves query performance", "Consolidates delta storage", "Runs automatically"],
      section: "Performance Optimization",
      marks: 1,
      note: "Note: There are 3 correct answers to this question."
    },
    {
      id: "50",
      type: "mcq" as const,
      question: "What is the recommended approach for handling large result sets?",
      options: ["Load all data at once", "Use pagination", "Disable caching", "Remove filters"],
      correctAnswer: "Use pagination",
      section: "Performance Optimization",
      marks: 1
    },
    {
      id: "51",
      type: "multiple" as const,
      question: "Which data replication methods are supported in SAP HANA Cloud?",
      options: ["SAP Data Intelligence", "SAP Replication Server", "Manual export/import", "Smart Data Integration"],
      correctAnswer: ["SAP Data Intelligence", "Smart Data Integration"],
      section: "Data Integration",
      marks: 1,
      note: "Note: There are 2 correct answers to this question."
    },
    {
      id: "52",
      type: "mcq" as const,
      question: "What protocol is commonly used for data integration with SAP HANA Cloud?",
      options: ["FTP", "OData", "SMTP", "Telnet"],
      correctAnswer: "OData",
      section: "Data Integration",
      marks: 1
    },
    {
      id: "53",
      type: "multiple" as const,
      question: "Which data sources can be connected to SAP HANA Cloud?",
      options: ["On-premise databases", "Cloud applications", "Flat files", "Blockchain networks"],
      correctAnswer: ["On-premise databases", "Cloud applications", "Flat files"],
      section: "Data Integration",
      marks: 1,
      note: "Note: There are 3 correct answers to this question."
    },
    {
      id: "54",
      type: "mcq" as const,
      question: "What is Smart Data Integration primarily used for?",
      options: ["Data backup", "Data transformation and replication", "User management", "Security auditing"],
      correctAnswer: "Data transformation and replication",
      section: "Data Integration",
      marks: 1
    },
    {
      id: "55",
      type: "multiple" as const,
      question: "Which data provisioning methods are available?",
      options: ["Real-time replication", "Batch loading", "Streaming", "Email transfer"],
      correctAnswer: ["Real-time replication", "Batch loading", "Streaming"],
      section: "Data Integration",
      marks: 1,
      note: "Note: There are 3 correct answers to this question."
    },
    {
      id: "56",
      type: "mcq" as const,
      question: "What format is best for bulk data loading into SAP HANA?",
      options: ["XML", "CSV", "PDF", "DOC"],
      correctAnswer: "CSV",
      section: "Data Integration",
      marks: 1
    },
    {
      id: "57",
      type: "multiple" as const,
      question: "Which SAP systems can integrate with SAP HANA Cloud?",
      options: ["SAP S/4HANA", "SAP BW/4HANA", "SAP SuccessFactors", "SAP Outlook"],
      correctAnswer: ["SAP S/4HANA", "SAP BW/4HANA", "SAP SuccessFactors"],
      section: "Data Integration",
      marks: 1,
      note: "Note: There are 3 correct answers to this question."
    },
    {
      id: "58",
      type: "mcq" as const,
      question: "What is the purpose of virtual tables in SAP HANA Cloud?",
      options: ["Store data permanently", "Access remote data without copying", "Improve security", "Create backups"],
      correctAnswer: "Access remote data without copying",
      section: "Data Integration",
      marks: 1
    },
    {
      id: "59",
      type: "multiple" as const,
      question: "Which data quality checks should be performed during integration?",
      options: ["Data validation", "Duplicate detection", "Schema matching", "Color coding"],
      correctAnswer: ["Data validation", "Duplicate detection", "Schema matching"],
      section: "Data Integration",
      marks: 1,
      note: "Note: There are 3 correct answers to this question."
    },
    {
      id: "60",
      type: "mcq" as const,
      question: "What is the recommended approach for initial data loads?",
      options: ["Load all data at peak hours", "Load data during off-peak hours", "Never load data", "Load randomly"],
      correctAnswer: "Load data during off-peak hours",
      section: "Data Integration",
      marks: 1
    },
    {
      id: "61",
      type: "multiple" as const,
      question: "Which high availability features are available in SAP HANA Cloud?",
      options: ["Automatic failover", "Data replication", "Load balancing", "Manual intervention required"],
      correctAnswer: ["Automatic failover", "Data replication", "Load balancing"],
      section: "High Availability",
      marks: 1,
      note: "Note: There are 3 correct answers to this question."
    },
    {
      id: "62",
      type: "mcq" as const,
      question: "What is the typical recovery time objective (RTO) for SAP HANA Cloud?",
      options: ["Hours", "Minutes", "Days", "Weeks"],
      correctAnswer: "Minutes",
      section: "High Availability",
      marks: 1
    },
    {
      id: "63",
      type: "multiple" as const,
      question: "Which components ensure high availability in SAP HANA Cloud?",
      options: ["Redundant infrastructure", "Automated backups", "Multi-zone deployment", "Single point of failure"],
      correctAnswer: ["Redundant infrastructure", "Automated backups", "Multi-zone deployment"],
      section: "High Availability",
      marks: 1,
      note: "Note: There are 3 correct answers to this question."
    },
    {
      id: "64",
      type: "mcq" as const,
      question: "What happens during an automatic failover?",
      options: ["Data is lost", "Service switches to standby system", "All connections are terminated permanently", "Manual restart required"],
      correctAnswer: "Service switches to standby system",
      section: "High Availability",
      marks: 1
    },
    {
      id: "65",
      type: "multiple" as const,
      question: "Which disaster recovery strategies are recommended?",
      options: ["Regular backup testing", "Geographic redundancy", "Ignore recovery plans", "Single datacenter only"],
      correctAnswer: ["Regular backup testing", "Geographic redundancy"],
      section: "High Availability",
      marks: 1,
      note: "Note: There are 2 correct answers to this question."
    },
    {
      id: "66",
      type: "mcq" as const,
      question: "What is the purpose of health monitoring in SAP HANA Cloud?",
      options: ["Track user activity", "Detect and prevent failures", "Increase costs", "Delete old data"],
      correctAnswer: "Detect and prevent failures",
      section: "High Availability",
      marks: 1
    },
    {
      id: "67",
      type: "multiple" as const,
      question: "Which metrics indicate potential availability issues?",
      options: ["High memory usage", "Frequent connection failures", "Low disk space", "Fast query response"],
      correctAnswer: ["High memory usage", "Frequent connection failures", "Low disk space"],
      section: "High Availability",
      marks: 1,
      note: "Note: There are 3 correct answers to this question."
    },
    {
      id: "68",
      type: "mcq" as const,
      question: "What is the benefit of multi-zone deployment?",
      options: ["Lower costs", "Protection against zone failures", "Slower performance", "No backups needed"],
      correctAnswer: "Protection against zone failures",
      section: "High Availability",
      marks: 1
    },
    {
      id: "69",
      type: "multiple" as const,
      question: "Which maintenance activities might cause brief downtime?",
      options: ["Version upgrades", "Security patches", "Regular queries", "Backup operations"],
      correctAnswer: ["Version upgrades", "Security patches"],
      section: "High Availability",
      marks: 1,
      note: "Note: There are 2 correct answers to this question."
    },
    {
      id: "70",
      type: "mcq" as const,
      question: "What is the recommended approach for planned maintenance?",
      options: ["Perform during peak hours", "Schedule during maintenance windows", "Never perform maintenance", "Surprise updates"],
      correctAnswer: "Schedule during maintenance windows",
      section: "High Availability",
      marks: 1
    },
    {
      id: "71",
      type: "multiple" as const,
      question: "Which cost factors should be considered for SAP HANA Cloud?",
      options: ["Compute resources", "Storage capacity", "Data transfer", "Number of users viewing data"],
      correctAnswer: ["Compute resources", "Storage capacity", "Data transfer"],
      section: "Cost Management",
      marks: 1,
      note: "Note: There are 3 correct answers to this question."
    },
    {
      id: "72",
      type: "mcq" as const,
      question: "What is the primary driver of compute costs?",
      options: ["Number of tables", "Memory size and CPU cores", "Number of schemas", "Database name length"],
      correctAnswer: "Memory size and CPU cores",
      section: "Cost Management",
      marks: 1
    },
    {
      id: "73",
      type: "multiple" as const,
      question: "Which strategies can reduce SAP HANA Cloud costs?",
      options: ["Right-sizing instances", "Data compression", "Stopping unused instances", "Increasing memory unnecessarily"],
      correctAnswer: ["Right-sizing instances", "Data compression", "Stopping unused instances"],
      section: "Cost Management",
      marks: 1,
      note: "Note: There are 3 correct answers to this question."
    },
    {
      id: "74",
      type: "mcq" as const,
      question: "What happens to costs when an instance is stopped?",
      options: ["Costs increase", "Compute costs stop, storage costs continue", "All costs stop", "Costs double"],
      correctAnswer: "Compute costs stop, storage costs continue",
      section: "Cost Management",
      marks: 1
    },
    {
      id: "75",
      type: "multiple" as const,
      question: "Which tools help monitor SAP HANA Cloud costs?",
      options: ["BTP Cockpit usage dashboard", "Cost and usage reports", "Email notifications", "Social media"],
      correctAnswer: ["BTP Cockpit usage dashboard", "Cost and usage reports"],
      section: "Cost Management",
      marks: 1,
      note: "Note: There are 2 correct answers to this question."
    },
    {
      id: "76",
      type: "mcq" as const,
      question: "What is the billing model for SAP HANA Cloud?",
      options: ["One-time payment", "Pay-as-you-go", "Free forever", "Donation-based"],
      correctAnswer: "Pay-as-you-go",
      section: "Cost Management",
      marks: 1
    },
    {
      id: "77",
      type: "multiple" as const,
      question: "Which features can be adjusted to optimize costs?",
      options: ["Instance size", "Backup retention period", "Number of replicas", "Database name"],
      correctAnswer: ["Instance size", "Backup retention period", "Number of replicas"],
      section: "Cost Management",
      marks: 1,
      note: "Note: There are 3 correct answers to this question."
    },
    {
      id: "78",
      type: "mcq" as const,
      question: "When is it recommended to scale down an instance?",
      options: ["During peak usage", "When resources are consistently underutilized", "Never", "Every hour"],
      correctAnswer: "When resources are consistently underutilized",
      section: "Cost Management",
      marks: 1
    },
    {
      id: "79",
      type: "multiple" as const,
      question: "Which best practices help manage SAP HANA Cloud costs?",
      options: ["Regular cost reviews", "Implement cost alerts", "Delete all data", "Ignore usage patterns"],
      correctAnswer: ["Regular cost reviews", "Implement cost alerts"],
      section: "Cost Management",
      marks: 1,
      note: "Note: There are 2 correct answers to this question."
    },
    {
      id: "80",
      type: "mcq" as const,
      question: "What is the impact of data compression on costs?",
      options: ["Increases storage costs", "Reduces storage costs", "No impact", "Doubles all costs"],
      correctAnswer: "Reduces storage costs",
      section: "Cost Management",
      marks: 1
    }
  ]
};
