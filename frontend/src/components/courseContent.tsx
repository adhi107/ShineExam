import React from "react";

export type LessonBlock =
  | { type: "paragraph"; text: string }
  | { type: "stat_grid"; title?: string; items: Array<{ label: string; value: string; detail?: string }> }
  | { type: "bullet_list"; title?: string; items: string[] }
  | { type: "comparison_table"; title?: string; columns: string[]; rows: string[][] }
  | { type: "callout"; tone?: "info" | "success" | "warning"; title: string; text: string }
  | { type: "image"; src: string; alt: string; caption?: string }
  | { type: "image_grid"; images: Array<{ src: string; alt: string; caption?: string }> }
  | { type: "card_grid"; title?: string; items: Array<{ title: string; text: string }> };

export interface LessonSection {
  id: string;
  title: string;
  intro?: string;
  blocks: LessonBlock[];
}

export interface LessonContent {
  version: number;
  slug: string;
  hero: {
    title: string;
    subtitle: string;
  };
  toc: Array<{ id: string; label: string }>;
  sections: LessonSection[];
}

export interface CourseMaterialRecord {
  id: string;
  dayNumber: number;
  title: string;
  content: string;
  contentType?: string;
  contentJson?: LessonContent | null;
  estimatedMinutes?: number;
  summary?: string;
}

const asset = (name: string) => `/assets/courses/devcon-day1/${name}`;
const dayTwoAsset = (name: string) => `/assets/courses/devcon-day2/${name}`;

export const DAY_ONE_LESSON: LessonContent = {
  version: 3,
  slug: "devcon-day-1",
  hero: {
    title: "Introduction to SAP ERP and ABAP",
    subtitle:
      "A detailed Day 1 learning page for the DevCon Campus Edition track, covering ERP foundations, SAP basics, consultant roles, architecture, ABAP scope, dictionary concepts, modularization, forms, and IDocs.",
  },
  toc: [
    { id: "orientation", label: "Course Orientation" },
    { id: "erp", label: "ERP Foundations" },
    { id: "sap", label: "What is SAP?" },
    { id: "consultants", label: "Consultant Landscape" },
    { id: "architecture", label: "SAP Architecture" },
    { id: "abap", label: "ABAP Foundations" },
    { id: "dictionary", label: "ABAP Dictionary" },
    { id: "select", label: "SELECT Statements" },
    { id: "modularization", label: "Modularization and MPP" },
    { id: "output", label: "Output and Integration" },
    { id: "source-slides", label: "Complete Slide Appendix" },
  ],
  sections: [
    {
      id: "orientation",
      title: "Course Orientation",
      intro:
        "The DevCon deck positions this module inside the wider *SAP S/4HANA ABAP & RAP Track (18-Day Structured Execution Plan)*. Day 1 is the foundation module. It introduces the business language, platform context, and technical vocabulary that the rest of the track builds on.",
      blocks: [
        { type: "image", src: asset("slide-02.png"), alt: "Day 1 module overview slide", caption: "The Day 1 module overview signals that this session is about SAP-ABAP fundamentals before hands-on development." },
        {
          type: "paragraph",
          text:
            "This opening matters because ABAP development never starts in isolation. Before writing a report, interface, form, or enhancement, a developer needs to understand *why enterprises adopt ERP*, *what SAP is solving*, *how consultant roles interact*, and *where ABAP sits in the overall SAP ecosystem*.",
        },
        {
          type: "callout",
          tone: "info",
          title: "Day 1 theme",
          text:
            "Think of this module as the language-building stage. It gives you the business and architectural context required to make sense of later technical work.",
        },
      ],
    },
    {
      id: "erp",
      title: "ERP Foundations",
      intro:
        "The first major concept in the deck is the move from fragmented business systems to integrated enterprise planning. *ERP* stands for *Enterprise Resource Planning*, and the presentation explains it as the coordinated management of enterprise resources such as organization, money, manpower, materials, manufacturing, production, sales, warehousing, planning, and integration.",
      blocks: [
        { type: "image", src: asset("slide-03.png"), alt: "Legacy scenario", caption: "In a legacy scenario, departments such as procurement, inventory, finance, production planning, sales, maintenance, and quality often operate in disconnected tracks." },
        {
          type: "paragraph",
          text:
            "In the *legacy scenario*, each department tends to maintain its own view of reality. Procurement can have one version of supplier activity, inventory another version of stock movement, finance a delayed version of value flow, and shop-floor teams a different version of execution status. When these systems are separate, people depend on repeated data entry, manual reconciliation, and delayed coordination between teams.",
        },
        { type: "image", src: asset("slide-04.png"), alt: "ERP overview", caption: "ERP brings enterprise resources, planning, and integration into a unified operational framework." },
        {
          type: "paragraph",
          text:
            "ERP changes the model by creating a *shared operational core*. Instead of every department tracking its own isolated transaction history, a single system coordinates the same business event across connected functions. A purchase can affect inventory expectations, finance entries, planning assumptions, and reporting visibility in a connected way.",
        },
        { type: "image", src: asset("slide-05.png"), alt: "After ERP", caption: "After ERP, the same business domains remain, but they are connected through one enterprise system." },
        {
          type: "bullet_list",
          title: "What changes after ERP adoption",
          items: [
            "Business processes become *cross-functional* instead of department-locked.",
            "Operational data becomes more *consistent* because teams act on shared records.",
            "Visibility improves because downstream teams can react earlier to upstream transactions.",
            "Management decisions rely less on stitched-together spreadsheets and more on system-driven reporting.",
          ],
        },
        { type: "image", src: asset("slide-06.png"), alt: "Integration benefits", caption: "The deck lists the major business benefits produced by integration." },
        {
          type: "bullet_list",
          title: "Integration benefits emphasized in the presentation",
          items: [
            "*Focus on business processes* rather than isolated functions.",
            "*Elimination of redundant data* by using common and consistent data.",
            "*Easier corporate consolidation* because the business works from a common source.",
            "*Better managerial control* through improved visibility and structure.",
            "*Elimination of interfaces* that otherwise exist between disconnected systems.",
            "*Faster reaction to changing structures* because the system model is integrated.",
          ],
        },
        { type: "image_grid", images: [
          { src: asset("slide-07.png"), alt: "ERP landscape packages", caption: "The ERP market includes SAP as well as BAAN, JD Edwards, PeopleSoft, and Oracle Financials." },
          { src: asset("slide-08.png"), alt: "What is SAP intro slide", caption: "The deck uses a transition slide to move from ERP understanding into SAP itself." },
        ]},
      ],
    },
    {
      id: "sap",
      title: "What is SAP?",
      intro:
        "After defining ERP, the deck narrows the focus to SAP. SAP is introduced as both a business platform and a named software ecosystem with its own historical expansion and architectural style.",
      blocks: [
        { type: "image", src: asset("slide-09.png"), alt: "SAP definition", caption: "The presentation explains the origin of the SAP name in German and its English translation." },
        {
          type: "comparison_table",
          title: "SAP name expansion",
          columns: ["Perspective", "Meaning"],
          rows: [
            ["German Origin", "Systeme Anwendungen Produkte in der Datenverarbeitung"],
            ["English Form", "Systems, Applications and Products in Data Processing"],
            ["Practical Interpretation", "An enterprise platform for running business processes through integrated applications"],
          ],
        },
        {
          type: "paragraph",
          text:
            "This is worth remembering because SAP is not merely a coding environment. It is an *enterprise application platform*. ABAP developers work inside that platform to support logistics, finance, sales, manufacturing, HR, reporting, output generation, and integration.",
        },
        { type: "image_grid", images: [
          { src: asset("slide-10.png"), alt: "SAP career path slide", caption: "The career path view reminds learners that SAP is a large ecosystem with multiple roles and specialization paths." },
          { src: asset("slide-11.png"), alt: "SAP ERP overview slide", caption: "SAP ERP sits within a business suite model that supports broad enterprise execution." },
        ]},
      ],
    },
    {
      id: "consultants",
      title: "Consultant Landscape",
      intro:
        "One of the most important Day 1 concepts is the distinction between *what the business needs* and *how the system is built to satisfy it*. The deck uses the consultant-type slide to explain that relationship clearly.",
      blocks: [
        { type: "image", src: asset("slide-12.png"), alt: "SAP consultant types diagram", caption: "Functional consultants define what the system should do. Technical, BASIS, and ABAP consultants define how it is implemented and operated." },
        {
          type: "paragraph",
          text:
            "A client begins with *business requirements*. Those requirements are interpreted into process expectations. Functional consultants convert that into business-facing logic and module decisions. Technical and ABAP consultants then decide how to implement those requirements in SAP. BASIS consultants support the underlying system landscape, transport behavior, and security foundation needed to run everything reliably.",
        },
        {
          type: "comparison_table",
          title: "Role responsibilities from the deck",
          columns: ["Role", "Focus", "Examples"],
          rows: [
            ["Functional", "Define *what* the system should do", "MM, PP, SD, HR, FI, CO, WM"],
            ["Technical", "Define *how* the requirement should be implemented", "Technical realization inside SAP"],
            ["BASIS", "Support infrastructure and platform operations", "Transport, security, administration"],
            ["ABAP", "Build custom logic and developments", "Programming, reports, interfaces, enhancements, forms"],
          ],
        },
        {
          type: "callout",
          tone: "success",
          title: "Why this matters for ABAP learners",
          text:
            "ABAP development becomes much easier to understand once you see it as one layer inside a wider delivery chain: business need -> functional specification -> technical implementation.",
        },
      ],
    },
    {
      id: "architecture",
      title: "SAP Architecture",
      intro:
        "The architecture portion of the PPT explains SAP R/3 as a *three-tier architecture* built around real-time processing and distributed system responsibilities.",
      blocks: [
        { type: "image", src: asset("slide-13.png"), alt: "SAP architecture slide", caption: "SAP R/3 is described as a three-tier architecture for real-time data processing." },
        {
          type: "bullet_list",
          title: "The three layers",
          items: [
            "*Presentation Layer*: the user-facing layer where screens and interactions happen.",
            "*Application Layer*: the execution layer that contains business logic and runtime processing.",
            "*Database Layer*: the persistence layer that stores and serves enterprise data.",
          ],
        },
        {
          type: "paragraph",
          text:
            "The deck also states that *R* stands for *Real Time Data Processing* and *3* refers to the *three-tier architecture*. This architecture matters because many ABAP concepts, performance considerations, and transaction behaviors only make sense when you understand that user actions, application logic, and data storage are separated by design.",
        },
        { type: "image", src: asset("slide-14.png"), alt: "Client server architecture", caption: "The client-server architecture slide complements the three-tier view by showing how system roles are distributed." },
        {
          type: "paragraph",
          text:
            "The client-server model is the operational framing around this architecture. Users act through clients, requests are processed through application services, and durable enterprise data lives in the database layer. That separation is one of the reasons SAP can coordinate large-scale enterprise workloads consistently.",
        },
      ],
    },
    {
      id: "abap",
      title: "ABAP Foundations",
      intro:
        "ABAP stands for *Advanced Business Application Programming*. Day 1 introduces it not just as a language name, but as the development backbone used to extend and adapt SAP for real business requirements.",
      blocks: [
        { type: "image", src: asset("slide-15.png"), alt: "ABAP acronym slide", caption: "The acronym breakdown introduces ABAP as Advanced Business Application Programming." },
        { type: "image", src: asset("slide-16.png"), alt: "ABAP language slide", caption: "ABAP is introduced as a 4GL, placing it closer to business-oriented and database-oriented development than lower-level programming languages." },
        {
          type: "paragraph",
          text:
            "The presentation categorizes ABAP as a *fourth-generation language*. In practical terms, that means ABAP is designed for business application productivity. Its core job is not systems programming in the low-level sense; it is to express enterprise rules, retrieve and shape business data, and build system-facing functionality inside SAP.",
        },
        {
          type: "comparison_table",
          title: "Language generation context from the deck",
          columns: ["Generation", "Typical meaning"],
          rows: [
            ["First generation", "Machine language"],
            ["Second generation", "Assembly language"],
            ["Third generation", "High-level languages such as C, C++, and Java"],
            ["Fourth generation", "Business-oriented languages often used for database access and application productivity"],
            ["Fifth generation", "Languages and systems associated with AI and neural networks"],
          ],
        },
        { type: "image_grid", images: [
          { src: asset("slide-17.png"), alt: "Transition slide", caption: "The deck uses a visual transition before opening into ABAP scope." },
          { src: asset("slide-18.png"), alt: "Contents of ABAP", caption: "The ABAP scope slide shows that ABAP covers much more than simple reports." },
        ]},
        {
          type: "card_grid",
          title: "Core ABAP scope areas in the presentation",
          items: [
            { title: "Reports", text: "Classic reports, lists, and ALV reports for structured business output." },
            { title: "Interfaces", text: "RFC, BAPI, ALE, and IDocs for communication between systems." },
            { title: "Conversions", text: "BDC and LSMW for migration and large-scale data movement." },
            { title: "Enhancements", text: "User exits, customer exits, and BAdIs for extending standard behavior." },
            { title: "Forms", text: "SAP Scripts and SmartForms for output documents." },
            { title: "Dialog Programming", text: "Screen-based transactions and module pool programs." },
            { title: "Data Dictionary", text: "Shared technical definitions for tables, structures, and domains." },
            { title: "OOP Concepts", text: "ABAP also grows into object-oriented development practices." },
          ],
        },
        { type: "image", src: asset("slide-19.png"), alt: "Enhancement architecture", caption: "The enhancement architecture slide explains how custom logic is added without replacing SAP standard objects directly." },
        {
          type: "paragraph",
          text:
            "This enhancement model is essential. SAP projects almost always need customer-specific behavior, but that behavior should be layered through approved extension mechanisms rather than by directly rewriting standard SAP code. That is how upgrades remain safer and the system stays maintainable.",
        },
        { type: "image_grid", images: [
          { src: asset("slide-20.png"), alt: "ABAP transition slide", caption: "A transition point in the deck before moving deeper into technical topics." },
          { src: asset("slide-21.png"), alt: "ABAP transition slide 2", caption: "Another visual transition before the dictionary and statement topics." },
        ]},
      ],
    },
    {
      id: "dictionary",
      title: "ABAP Dictionary",
      intro:
        "The data dictionary portion explains why SAP needs a central repository for technical definitions. In ABAP development, the dictionary is where shared meaning becomes reusable structure.",
      blocks: [
        { type: "image", src: asset("slide-22.png"), alt: "Advantages of data dictionary", caption: "The presentation lists the reasons the ABAP Dictionary is central to maintainable SAP development." },
        {
          type: "bullet_list",
          title: "Key dictionary benefits from the deck",
          items: [
            "It helps create *platform-independent* programs.",
            "It avoids inconsistencies when data types are reused across the application.",
            "It reduces redundancy and lowers maintenance effort.",
            "A change to a dictionary-defined type can automatically affect all dependent programs and objects.",
            "It serves as a strong information source for developers and users exploring tables and structures.",
          ],
        },
        {
          type: "paragraph",
          text:
            "That last point is especially important for beginners. The ABAP Dictionary is not only a configuration layer; it is also one of the best discovery tools in SAP. If you want to understand the structure of a table, the meaning of a field, or the shape of shared metadata, the dictionary is a starting point.",
        },
        { type: "image", src: asset("slide-23.png"), alt: "Data dictionary objects", caption: "The deck highlights that the ABAP Dictionary contains multiple object types, not just tables." },
        { type: "image", src: asset("slide-24.png"), alt: "Data types fixed length", caption: "The predefined ABAP types slide introduces runtime-fixed data type behavior." },
        {
          type: "paragraph",
          text:
            "The data-type slide reminds learners that ABAP development is tightly connected to field definitions, byte lengths, and predictable storage behavior. Even when you focus on application logic, the technical shape of data still matters.",
        },
        { type: "image", src: asset("slide-25.png"), alt: "Write statement and uline", caption: "The write-statement slide shows how even classical list output in ABAP depends on well-understood syntax and formatting control." },
      ],
    },
    {
      id: "select",
      title: "SELECT Statements",
      intro:
        "Almost every meaningful ABAP program reads business data. That is why the presentation gives specific attention to the *SELECT* statement and its clauses.",
      blocks: [
        { type: "image", src: asset("slide-27.png"), alt: "Select statements", caption: "The SELECT statement slide breaks down the major clauses used for database reads." },
        {
          type: "comparison_table",
          title: "SELECT clause roles",
          columns: ["Clause", "Purpose"],
          rows: [
            ["SELECT <result>", "Defines which columns or data shape should be read."],
            ["INTO TABLE <target>", "Specifies the target internal table or receiving structure."],
            ["FROM <source>", "Specifies the table or view that provides the data."],
            ["WHERE <cond>", "Applies line-level filtering conditions."],
            ["GROUP BY <fields>", "Builds grouped result lines from common values."],
            ["HAVING <cond>", "Filters aggregated groups after grouping logic."],
            ["ORDER BY <fields>", "Controls the ordering of the resulting dataset."],
          ],
        },
        {
          type: "paragraph",
          text:
            "For a learner, the important idea is this: *ABAP programs are often data-shaped*. The structure of your read determines what your logic can do next. If you misunderstand selection scope, filtering, grouping, or target structure, the rest of the program becomes harder to reason about.",
        },
        { type: "image", src: asset("slide-26.png"), alt: "Transition slide before SELECT", caption: "The deck uses another transition slide before entering statement-level concepts." },
      ],
    },
    {
      id: "modularization",
      title: "Modularization and Module Pool Concepts",
      intro:
        "The later technical section emphasizes that ABAP is not only about individual statements. It also has strong ideas about *how code should be organized* and *how processing blocks are structured*.",
      blocks: [
        { type: "image", src: asset("slide-28.png"), alt: "Modularization techniques", caption: "The modularization slide divides runtime-called blocks and program-called procedures." },
        {
          type: "bullet_list",
          title: "Processing blocks called by the ABAP runtime system",
          items: [
            "Event blocks",
            "Dialog modules",
          ],
        },
        {
          type: "bullet_list",
          title: "Processing blocks called by ABAP programs",
          items: [
            "Subroutines",
            "Function modules",
            "Methods",
          ],
        },
        {
          type: "paragraph",
          text:
            "The deck also notes that local macros and global include programs are additional ways to organize source code. In other words, modularization in ABAP is both *behavioral* and *structural*: you modularize through executable blocks and through source organization.",
        },
        { type: "image_grid", images: [
          { src: asset("slide-29.png"), alt: "Transition slide before MPP", caption: "A transition slide before module pool programming." },
          { src: asset("slide-30.png"), alt: "Module pool programming", caption: "Module Pool Programming (MPP) is part of the dialog-programming family in ABAP." },
        ]},
        {
          type: "paragraph",
          text:
            "Module Pool Programming belongs to the screen-driven side of ABAP. While classical reporting focuses on list output, module pools are about dialog interaction and application flow through screens and modules.",
        },
        { type: "image_grid", images: [
          { src: asset("slide-31.png"), alt: "Transition slide before BDC", caption: "A transition slide before conversion content." },
          { src: asset("slide-32.png"), alt: "Batch Data Communication", caption: "Batch Data Communication (BDC) appears in the conversion area of ABAP scope." },
        ]},
      ],
    },
    {
      id: "output",
      title: "Output and Integration",
      intro:
        "The closing Day 1 material shifts into output technologies and integration mechanisms, both of which are central to real SAP implementations.",
      blocks: [
        { type: "image", src: asset("slide-33.png"), alt: "Components of SAP Scripts", caption: "SAP Scripts combines an output program, layout set, output determination configuration, and printer or font configuration." },
        {
          type: "comparison_table",
          title: "SAP Scripts components explained",
          columns: ["Component", "Role in the output process"],
          rows: [
            ["Output program", "Extracts data from the SAP data dictionary and application tables."],
            ["Layout set", "Formats the extracted data into a printable structure."],
            ["Output determination configuration", "Controls when output is triggered and where it is sent."],
            ["Printer / Font configuration", "Supports device, font, barcode, logo, and print behavior setup."],
          ],
        },
        {
          type: "paragraph",
          text:
            "This is a strong example of how ABAP work connects business data with presentation requirements. A document such as an invoice is never only a form layout problem. It depends on business data extraction, event triggering, output rules, and target device setup.",
        },
        { type: "image", src: asset("slide-34.png"), alt: "SmartForms slide", caption: "SmartForms is presented as another major SAP output technology." },
        { type: "image_grid", images: [
          { src: asset("slide-35.png"), alt: "Transition slide before integration close", caption: "A transition slide moving into the final integration topic." },
          { src: asset("slide-36.png"), alt: "Transition slide before IDocs", caption: "Another lead-in slide before the IDoc concept." },
        ]},
        { type: "image", src: asset("slide-37.png"), alt: "IDocs diagram", caption: "IDocs are document-based, asynchronous integration structures used between SAP and other systems." },
        {
          type: "paragraph",
          text:
            "The IDoc slide is especially important for understanding SAP integration. IDocs support *asynchronous, document-related communication* between SAP systems, EDI subsystems, legacy environments, and third-party software. In practical enterprise landscapes, that means one system can issue a structured business message without requiring synchronous processing on the other side at that exact moment.",
        },
        {
          type: "callout",
          tone: "warning",
          title: "Why the module ends here",
          text:
            "By ending on forms and IDocs, the deck reinforces that ABAP is not just about internal programming logic. It is also about communicating business information outward, whether through printed documents or cross-system messages.",
        },
      ],
    },
    {
      id: "source-slides",
      title: "Complete Slide Appendix",
      intro:
        "The article above explains the Day 1 material in a guided format. The full original slide visuals are also included below so learners can review every source frame directly inside the course page.",
      blocks: [
        {
          type: "image_grid",
          images: Array.from({ length: 37 }, (_, index) => {
            const slideNumber = `${index + 2}`.padStart(2, "0");
            return {
              src: asset(`slide-${slideNumber}.png`),
              alt: `Day 1 slide ${slideNumber}`,
              caption: `Slide ${slideNumber}`,
            };
          }),
        },
      ],
    },
  ],
};

export const DAY_TWO_LESSON: LessonContent = {
  version: 2,
  slug: "devcon-day-2",
  hero: {
    title: "ABAP Data Dictionary",
    subtitle:
      "A detailed Day 2 learning page covering DDIC foundations, domains, data elements, tables, search helps, lock objects, structures, type groups, key transactions, and the full exercise set from the DevCon DDIC deck.",
  },
  toc: [
    { id: "overview", label: "Module Overview" },
    { id: "ddic-basics", label: "What Is DDIC?" },
    { id: "domains", label: "Domains" },
    { id: "data-elements", label: "Data Elements" },
    { id: "tables", label: "Database Tables" },
    { id: "table-types", label: "Table Types" },
    { id: "search-lock", label: "Search Helps and Locks" },
    { id: "structures", label: "Structures and Type Groups" },
    { id: "transactions", label: "Key Transaction Codes" },
    { id: "summary", label: "Summary" },
    { id: "exercises", label: "Exercises and Assignment" },
  ],
  sections: [
    {
      id: "overview",
      title: "Module Overview",
      intro:
        "Day 2 moves from high-level SAP orientation into one of the most important ABAP foundations: the *ABAP Data Dictionary*. The deck agenda is direct and practical. It covers *Domains*, *Data Elements*, *Tables*, *Search Helps*, and *Lock Objects*, then closes with reference transactions, a summary, and hands-on exercises.",
      blocks: [
        {
          type: "bullet_list",
          title: "Day 2 agenda from the PPT",
          items: [
            "*Domains* for technical field definitions.",
            "*Data Elements* for semantic field meaning and user-facing metadata.",
            "*Tables* for persistent data storage and key design.",
            "*Search Helps* for guided value selection.",
            "*Lock Objects* for safe concurrent editing.",
          ],
        },
        {
          type: "callout",
          tone: "info",
          title: "Why this day matters",
          text:
            "Most ABAP application work depends on reliable data definitions. If the dictionary layer is weak, every report, screen, interface, and transaction built on top of it becomes harder to maintain.",
        },
      ],
    },
    {
      id: "ddic-basics",
      title: "What Is DDIC?",
      intro:
        "The presentation defines the *ABAP Data Dictionary (DDIC)* as the central repository in SAP that stores and manages data definitions, types, and structures. It acts as a *single source of truth* for ABAP programs, screens, and database tables.",
      blocks: [
        {
          type: "image",
          src: dayTwoAsset("image4.png"),
          alt: "ABAP Dictionary initial screen from SE11",
          caption: "SE11 is the central transaction for creating and managing DDIC objects such as tables, domains, data elements, views, structures, search helps, and lock objects.",
        },
        {
          type: "card_grid",
          title: "Core DDIC ideas from the deck",
          items: [
            {
              title: "Central Repository",
              text:
                "DDIC stores common definitions once so ABAP development objects can reuse them instead of redefining field behavior in many places.",
            },
            {
              title: "SE11",
              text:
                "The main transaction for creating and maintaining dictionary objects across tables, data types, views, and related metadata.",
            },
            {
              title: "Active and Inactive Versions",
              text:
                "Dictionary objects can exist in inactive form while being edited. They affect runtime only after *activation*.",
            },
            {
              title: "Cross-Client Definitions",
              text:
                "DDIC definitions are shared across clients, even though transactional table data itself may still be client-specific.",
            },
          ],
        },
        {
          type: "paragraph",
          text:
            "This central-repository model is one of the reasons SAP development stays consistent at scale. A field like vendor number, company code, posting date, or material number can be defined once and then reused across many tables, screens, and logic paths without rewriting the same technical rules repeatedly.",
        },
      ],
    },
    {
      id: "domains",
      title: "Domains",
      intro:
        "A *Domain* gives the *technical definition* of a field. The deck describes it as the place where you define data type, field length, decimal places, and permitted value range.",
      blocks: [
        {
          type: "comparison_table",
          title: "Domain properties from the PPT",
          columns: ["Property", "Meaning"],
          rows: [
            ["Data Type", "Technical base such as CHAR, NUMC, DATS, INT4, DEC, or FLTP"],
            ["Length", "Character or byte length for the stored field"],
            ["Decimal Places", "Precision handling for numeric types such as DEC or CURR"],
            ["Value Range", "Fixed values or intervals that guide valid input"],
            ["Output Length", "How many characters are shown on screen"],
            ["Case Sensitive", "Whether lower and upper case distinctions matter for input"],
          ],
        },
        {
          type: "comparison_table",
          title: "Common ABAP data types called out in the deck",
          columns: ["Type", "Purpose"],
          rows: [
            ["CHAR", "Character text"],
            ["NUMC", "Numeric-only text"],
            ["DATS", "Date in YYYYMMDD format"],
            ["INT4", "Integer number"],
            ["DEC", "Packed decimal number"],
          ],
        },
        {
          type: "paragraph",
          text:
            "The key lesson from the slide is reuse. *One domain can be reused by many data elements*. That means if the technical characteristics of a business field change later, you adjust the domain once and the updated behavior can flow into many dependent objects.",
        },
        {
          type: "callout",
          tone: "success",
          title: "Practical mindset",
          text:
            "Use domains to standardize technical rules. If multiple fields have the same storage behavior, they should usually not invent separate technical definitions.",
        },
      ],
    },
    {
      id: "data-elements",
      title: "Data Elements",
      intro:
        "If the domain answers the technical question, the *Data Element* answers the semantic one. The PPT describes data elements as the place for field labels, F1 help, search help assignment, and parameter IDs.",
      blocks: [
        {
          type: "comparison_table",
          title: "Inheritance chain highlighted in the deck",
          columns: ["Layer", "Responsibility"],
          rows: [
            ["Domain", "Technical characteristics such as type, length, and allowed values"],
            ["Data Element", "Business meaning, labels, documentation, and reusable field semantics"],
            ["Table Field / Structure Component", "Concrete usage of the definition inside a table or structure"],
          ],
        },
        {
          type: "bullet_list",
          title: "Capabilities of a data element",
          items: [
            "*Field labels* for short, medium, long, and heading text in screens and ALV output.",
            "*F1 help documentation* so users can read context-sensitive field help.",
            "*Search help assignment* so value help can be attached directly at the semantic layer.",
            "*Parameter IDs* so user input and memory behavior can be integrated where appropriate.",
          ],
        },
        {
          type: "paragraph",
          text:
            "The slide’s chain, *Domain -> Data Element -> Table Field*, is one of the most important DDIC relationships to remember. It explains how SAP separates technical consistency from business meaning. The same technical domain may support multiple business fields, while different data elements add distinct labels and help text for each usage.",
        },
      ],
    },
    {
      id: "tables",
      title: "Database Tables",
      intro:
        "The database-table section explains how SAP tables are defined through SE11 and uses a custom *ZEMPLOYEE* example to show keys, field names, data elements, types, and lengths.",
      blocks: [
        {
          type: "comparison_table",
          title: "ZEMPLOYEE example from the deck",
          columns: ["Field Name", "Key", "Data Element", "Type", "Length"],
          rows: [
            ["MANDT", "Yes", "MANDT", "CLNT", "3"],
            ["EMP_ID", "Yes", "ZEMPID", "NUMC", "8"],
            ["EMP_NAME", "No", "ZEMPNAME", "CHAR", "40"],
            ["DEPT", "No", "ZDEPT", "CHAR", "20"],
            ["SALARY", "No", "ZSALARY", "DEC", "13,2"],
            ["HIRE_DATE", "No", "ZDATS", "DATS", "8"],
            ["IS_ACTIVE", "No", "ZFLAG", "CHAR", "1"],
          ],
        },
        {
          type: "card_grid",
          title: "Table settings the slide explains",
          items: [
            {
              title: "Client Field (MANDT)",
              text:
                "Usually the first key field in client-dependent tables, ensuring logical separation of data across clients or mandants.",
            },
            {
              title: "Primary Key",
              text:
                "The combination of fields that uniquely identifies each row. In the example, it is *MANDT + business key*.",
            },
            {
              title: "Delivery Class",
              text:
                "Defines the nature of the data, such as application data, customizing, or system-owned content.",
            },
            {
              title: "Data Class",
              text:
                "Guides the storage category, for example master, transaction, or temporary data behavior.",
            },
            {
              title: "Size Category",
              text:
                "Helps the database estimate storage needs according to expected row counts.",
            },
            {
              title: "Buffering",
              text:
                "Controls whether reads are served from database only or may use table buffering for performance.",
            },
          ],
        },
        {
          type: "paragraph",
          text:
            "This slide is practical rather than theoretical. It shows that table design in SAP is not just about listing columns. You must think about *client dependency*, *key strategy*, *storage behavior*, and *runtime access patterns* at the same time.",
        },
      ],
    },
    {
      id: "table-types",
      title: "Types of Tables in DDIC",
      intro:
        "The deck distinguishes three DDIC table storage models: *Transparent*, *Pooled*, and *Cluster*. It also notes that on *SAP HANA*, pooled and cluster tables are converted to transparent tables automatically.",
      blocks: [
        {
          type: "comparison_table",
          title: "Transparent vs Pooled vs Cluster",
          columns: ["Type", "Storage Model", "Key Characteristics", "Examples"],
          rows: [
            [
              "Transparent",
              "1:1 mapping to one physical database table",
              "Direct SQL access, own DB table, good for master and transaction data, supports secondary indexes",
              "MARA, EKKO, VBAK, LFA1",
            ],
            [
              "Pooled",
              "Many SAP tables stored inside one pool table",
              "Used for small config or control tables, no native SQL access, no secondary indexes",
              "TVARVC, D010TAB",
            ],
            [
              "Cluster",
              "Many SAP tables stored together in one cluster table",
              "Compressed storage, restricted SQL behavior, useful for tightly related parent-child style datasets",
              "PCL1, PCL2",
            ],
          ],
        },
        {
          type: "paragraph",
          text:
            "For modern learners, the HANA note is especially useful. Older SAP landscapes relied more visibly on pooled and cluster behavior, but HANA changes how these are represented physically. The conceptual distinction still matters because many legacy explanations, dictionary objects, and interview questions still reference these classic categories.",
        },
      ],
    },
    {
      id: "search-lock",
      title: "Search Helps and Lock Objects",
      intro:
        "The next pair of topics focuses on usability and data integrity. *Search helps* make input easier and more accurate, while *lock objects* protect records from conflicting updates by multiple users.",
      blocks: [
        {
          type: "comparison_table",
          title: "Search help types",
          columns: ["Type", "Purpose"],
          rows: [
            [
              "Elementary Search Help",
              "A single F4 dialog based on one selection method with import/export parameters and defined hit-list columns.",
            ],
            [
              "Collective Search Help",
              "A grouped dialog containing multiple elementary helps so users can search by different criteria such as number or name.",
            ],
          ],
        },
        {
          type: "paragraph",
          text:
            "The slide emphasizes that F4 help is not just convenience. It is also a data-quality tool. When users select from valid values rather than typing free-form inputs, consistency improves and downstream process errors are reduced.",
        },
        {
          type: "paragraph",
          text:
            "For locking, the deck explains that SAP uses *application-level locking*, not direct database locks, for many business edit scenarios. A lock object generates two function modules: *ENQUEUE_<ObjectName>* to set the lock and *DEQUEUE_<ObjectName>* to release it.",
        },
        {
          type: "bullet_list",
          title: "Lock flow from the slide",
          items: [
            "Open record",
            "Call *ENQUEUE*",
            "Lock is set",
            "Edit data",
            "Call *DEQUEUE*",
            "Lock is released",
          ],
        },
        {
          type: "comparison_table",
          title: "Lock types listed in the PPT",
          columns: ["Lock Type", "Meaning"],
          rows: [
            ["Exclusive (E)", "Only one user can hold the lock; most restrictive model"],
            ["Shared (S)", "Multiple shared locks allowed; blocks exclusive update while active"],
            ["Exclusive Non-Cumulative (X)", "Even the same user cannot set it twice recursively"],
            ["Optimistic (O)", "Starts shared and becomes exclusive at save time"],
          ],
        },
      ],
    },
    {
      id: "structures",
      title: "Structures and Type Groups",
      intro:
        "Not every reusable data definition needs a physical table. The deck introduces *Structures* and *Type Groups* as dictionary-based reuse tools for ABAP programs, function modules, BAPIs, and shared type definitions.",
      blocks: [
        {
          type: "bullet_list",
          title: "DDIC structures",
          items: [
            "Have *no physical database table* behind them.",
            "Group fields from one or more tables into a reusable typed container.",
            "Can be used as parameter types for *Function Modules* and *BAPIs*.",
            "Support *INCLUDE STRUCTURE* for composition and reuse.",
            "Allow *nested structures* where one structure contains another.",
            "Can be used in ALV field catalog and output-layout contexts.",
          ],
        },
        {
          type: "paragraph",
          text:
            "The example called out in the deck is *LFA1_KEY*, a vendor-key structure. That is a good illustration of why structures matter: sometimes you need a clean typed package of fields without creating a real database object.",
        },
        {
          type: "paragraph",
          text:
            "Type groups, created via SE11 as *Type Group*, let you define *global constants and reusable types* that many programs can share. The slide shows a *TYPE-POOL* example where names, amounts, flags, and constants are declared centrally and then consumed with *TYPE-POOLS* inside ABAP programs.",
        },
        {
          type: "callout",
          tone: "warning",
          title: "Design takeaway",
          text:
            "Choose the lightest object that solves the problem. If you only need reusable typing, a structure or type group may be better than creating a physical table.",
        },
      ],
    },
    {
      id: "transactions",
      title: "Key Transaction Codes",
      intro:
        "The deck closes its reference content with the DDIC transactions every ABAP learner should know. These are the daily entry points for definition, display, maintenance, and inspection work.",
      blocks: [
        {
          type: "comparison_table",
          title: "Quick reference transactions",
          columns: ["T-Code", "Purpose"],
          rows: [
            ["SE11", "Main ABAP Dictionary transaction for tables, domains, data elements, views, and structures"],
            ["SE12", "Display dictionary objects in read-only mode"],
            ["SE13", "Maintain technical settings such as data class, size category, and buffering"],
            ["SE14", "Database utility and adjustment support for dictionary-table changes"],
            ["SM30", "Maintain customizing tables and views through generated maintenance dialogs"],
            ["SE16", "Classic data browser with filter-based table display"],
            ["SE16N", "Enhanced table browser with additional technical display capability"],
            ["SE54", "Table/view maintenance generator-related setup and maintenance"],
          ],
        },
        {
          type: "paragraph",
          text:
            "Even before learners become fast coders, they should become comfortable moving around these transactions. A large part of ABAP productivity comes from knowing where definitions live and how to inspect them efficiently.",
        },
      ],
    },
    {
      id: "summary",
      title: "Summary",
      intro:
        "The summary slide condenses the whole DDIC module into a compact revision list. It is useful as a final checkpoint before moving into exercises.",
      blocks: [
        {
          type: "card_grid",
          items: [
            { title: "Domains", text: "Technical field definitions including type, length, value range, and conversion behavior." },
            { title: "Data Elements", text: "Semantic definitions with labels, F1 help, F4 search help, and parameter IDs." },
            { title: "Database Tables", text: "Transparent, pooled, and cluster storage models plus delivery class and data class decisions." },
            { title: "Views", text: "Database, projection, help, and maintenance views for different access needs." },
            { title: "Search Helps", text: "Elementary and collective F4 dialogs driven by parameter mapping and selection methods." },
            { title: "Lock Objects", text: "ENQUEUE and DEQUEUE-based locking for exclusive, shared, and optimistic patterns." },
            { title: "Structures", text: "Reusable typed containers without physical persistence." },
            { title: "Type Groups", text: "Shared constants and types made available through TYPE-POOL and TYPE-POOLS." },
          ],
        },
      ],
    },
    {
      id: "exercises",
      title: "Exercises and Assignment",
      intro:
        "The final slides move from theory into hands-on build work. They ask learners to create dictionary objects, use direct data types and domain/data-element reuse, define table relationships, and produce a basic custom report.",
      blocks: [
        {
          type: "comparison_table",
          title: "Exercise 1: Vendor bank table using direct data types",
          columns: ["Field Description", "Data Type", "Length"],
          rows: [
            ["Vendor Number", "CHAR", "10"],
            ["Bank Country Key", "CHAR", "3"],
            ["Bank Key", "CHAR", "06"],
            ["Bank Acc. No", "CHAR", "12"],
            ["Name of the Holder", "CHAR", "35"],
          ],
        },
        {
          type: "bullet_list",
          title: "Exercise progression from the deck",
          items: [
            "Create the bank table once using *direct data types*.",
            "Create the same table again using *domains and data elements*.",
            "Create multiple tables with shared address-style fields and use *INCLUDE STRUCTURE* for common definitions.",
          ],
        },
        {
          type: "comparison_table",
          title: "Shared fields called out for the multi-table exercise",
          columns: ["Field", "Suggested Type"],
          rows: [
            ["LIFNR / KUNNR / BUKRS", "CHAR 10 style identifier fields by table purpose"],
            ["NAME1", "CHAR 35"],
            ["ORT01", "CHAR 35"],
            ["ORT02", "CHAR 35"],
            ["STRAS", "CHAR 40"],
            ["LAND1", "CHAR 3"],
          ],
        },
        {
          type: "comparison_table",
          title: "Assignment: Doctor and Pharmacy tables",
          columns: ["Table", "Field", "Type", "Notes"],
          rows: [
            ["Doctor", "Doctor ID", "NUMC(3)", "Primary key"],
            ["Doctor", "Doctor Name", "NAME1", "Use standard data element where possible"],
            ["Doctor", "Hospital Name", "CHAR(20)", "Custom field"],
            ["Doctor", "Experience", "NUMC(2)", "Custom field"],
            ["Doctor", "Specialization", "CHAR(20)", "Custom field"],
            ["Pharmacy", "Medical ID", "NUMC(5)", "Primary key"],
            ["Pharmacy", "Medical Name", "CHAR", "Choose an appropriate length"],
            ["Pharmacy", "Price", "INT(4)", "Numeric field"],
            ["Pharmacy", "Ref Doctor", "NUMC(3)", "Foreign key to Doctor"],
            ["Pharmacy", "Expiry Date", "DATS", "Date field"],
          ],
        },
        {
          type: "bullet_list",
          title: "Technical requirements from the assignment slide",
          items: [
            "Create *domains and data elements* for all custom fields.",
            "Use *standard SAP data elements* wherever applicable.",
            "Maintain proper *primary key and foreign key relationships*.",
            "Insert at least *10 records* into each table.",
          ],
        },
        {
          type: "bullet_list",
          title: "Custom report development steps",
          items: [
            "Create a custom report in *SE38*.",
            "Take *Doctor ID* as an input on the selection screen.",
            "Fetch and display the matching Doctor table data.",
            "Present the output clearly on the output screen.",
          ],
        },
        {
          type: "callout",
          tone: "success",
          title: "Expected outcome",
          text:
            "By completing the Day 2 exercises, learners practice custom table creation, domain and data-element modeling, table relationships, and a basic end-to-end ABAP report that reads from those tables.",
        },
      ],
    },
  ],
};

export const DAY_THREE_LESSON: LessonContent = {
  version: 1,
  slug: "devcon-day-3",
  hero: {
    title: "Control Structures, Internal Tables, and Clean ABAP",
    subtitle:
      "A detailed Day 3 learning page covering structures, work areas, internal tables, IF and CASE logic, LOOP and repetition patterns, inline declarations, modern ABAP syntax, clean naming, and the full practice exercises from the controlling-techniques deck.",
  },
  toc: [
    { id: "overview", label: "Module Overview" },
    { id: "structures", label: "Structures" },
    { id: "workareas", label: "Work Areas" },
    { id: "itab", label: "Internal Tables" },
    { id: "if", label: "IF Control Structures" },
    { id: "case", label: "CASE Statement" },
    { id: "loops", label: "LOOP, DO, and WHILE" },
    { id: "inline", label: "Inline Declarations" },
    { id: "clean-abap", label: "Clean ABAP" },
    { id: "syntax", label: "Old vs New Syntax" },
    { id: "summary", label: "Summary" },
    { id: "exercises", label: "Exercises" },
  ],
  sections: [
    {
      id: "overview",
      title: "Module Overview",
      intro:
        "Day 3 moves into the practical ABAP coding layer. The deck focuses on the data containers and control structures developers use every day: *structures*, *work areas*, *internal tables*, *IF*, *CASE*, *LOOP*, *DO*, *WHILE*, *inline declarations*, and *Clean ABAP* style.",
      blocks: [
        {
          type: "bullet_list",
          title: "Agenda from the Day 3 deck",
          items: [
            "*Structure* for grouping related fields under a single name.",
            "*Work area and internal tables* for row-based and multi-row data handling.",
            "*IF / ELSEIF / ELSE / ENDIF* with comparison and logical operators.",
            "*CASE* for multi-way branching.",
            "*LOOP*, *DO*, and *WHILE* for iterative processing.",
            "*Inline declarations* for modern point-of-use variable definition.",
            "*Clean ABAP* naming and readability rules.",
          ],
        },
        {
          type: "callout",
          tone: "info",
          title: "Day 3 theme",
          text:
            "This module is about writing clearer ABAP. It connects language syntax, data handling, and clean coding habits so learners can move from isolated statements to readable program flow.",
        },
      ],
    },
    {
      id: "structures",
      title: "Structures",
      intro:
        "The deck presents *Structures in ABAP* as the building block of data modeling. A structure groups related fields under a single named type so one variable can carry a meaningful business record instead of a loose set of scalar fields.",
      blocks: [
        {
          type: "bullet_list",
          title: "Key structure concepts from the slide",
          items: [
            "Use *TYPES: BEGIN OF ... END OF ...* to define a named structure type.",
            "Use *DATA* to create a variable of that structure type.",
            "All fields live inside a single logical container.",
            "Fields are accessed with *dash notation*, such as `ls_emp-name` or `ls_emp-salary`.",
          ],
        },
        {
          type: "paragraph",
          text:
            "The example in the deck defines a `ty_employee` structure with fields such as employee number, name, department, and salary. A corresponding variable like `ls_emp` can then be filled field by field and used as a single record in reports, loops, or internal tables.",
        },
        {
          type: "callout",
          tone: "success",
          title: "Why structures matter",
          text:
            "Structures let ABAP code speak in business records instead of disconnected variables. That makes loops, table processing, and method interfaces easier to understand.",
        },
      ],
    },
    {
      id: "workareas",
      title: "Work Areas",
      intro:
        "A *work area* is described in the PPT as a single-row buffer used for reading and writing data from internal tables and the database. It represents one line at a time, while the internal table holds the full collection.",
      blocks: [
        {
          type: "bullet_list",
          title: "Work area usage patterns from the deck",
          items: [
            "*APPEND wa TO itab* adds the current work-area row to an internal table.",
            "*LOOP AT itab INTO wa* copies each row into the work area for processing.",
            "*READ TABLE itab INTO wa WITH KEY ...* loads a matching row into the work area.",
            "*MODIFY itab FROM wa* writes back changes made in the work area.",
          ],
        },
        {
          type: "paragraph",
          text:
            "The deck also stresses the relationship between structure and work area: the work area variable usually has the same row type as the internal table it is working with. That is why prefixes like `ls_` and `lt_` are so common in ABAP naming conventions.",
        },
        {
          type: "paragraph",
          text:
            "Conceptually, a work area is ideal when the program needs to inspect, change, or append *one record at a time*. It is small, local, and very easy to reason about in classic ABAP loops.",
        },
      ],
    },
    {
      id: "itab",
      title: "Internal Tables",
      intro:
        "The *Internal Tables* slide explains that internal tables are dynamic in-memory collections used to store and process multiple structured rows. They are one of the most central data-handling tools in ABAP.",
      blocks: [
        {
          type: "comparison_table",
          title: "Internal table types in the deck",
          columns: ["Table Type", "Behavior", "Typical Use"],
          rows: [
            ["Standard Table", "Default sequential-access table", "General-purpose APPEND and LOOP processing"],
            ["Sorted Table", "Maintains sorted key order automatically", "Faster key-based search with ordering"],
            ["Hashed Table", "Hash-based exact-key access", "Fastest exact-key lookup when order is not important"],
          ],
        },
        {
          type: "bullet_list",
          title: "Key operations highlighted",
          items: [
            "*APPEND* to add a row.",
            "*INSERT* to place rows with more control.",
            "*DELETE* to remove rows.",
            "*MODIFY* to change an existing row.",
            "*READ TABLE* to retrieve a specific row.",
          ],
        },
        {
          type: "paragraph",
          text:
            "The example in the deck uses a custom material structure and a table declared as `TABLE OF ty_material`. Rows are filled through `SELECT ... INTO TABLE`, then processed through a loop. This pattern appears repeatedly in real ABAP development because internal tables act as the working dataset for business logic.",
        },
      ],
    },
    {
      id: "if",
      title: "IF Control Structures",
      intro:
        "The Day 3 module treats *IF* as the foundation of logic control in ABAP. The syntax is simple, but the slide emphasizes several language-specific details that matter if a learner is coming from Java, C, or JavaScript.",
      blocks: [
        {
          type: "bullet_list",
          title: "Syntax reminders from the deck",
          items: [
            "Every IF block must end with *ENDIF*.",
            "ABAP uses *ELSEIF* as one word, not `ELSE IF`.",
            "Conditions do not need parentheses: `IF x > 0.`",
            "Logical operators are *AND*, *OR*, and *NOT*.",
          ],
        },
        {
          type: "comparison_table",
          title: "Comparison operators and word forms",
          columns: ["Symbol", "Word Form", "Meaning"],
          rows: [
            ["=", "EQ", "Equal to"],
            ["<>", "NE", "Not equal to"],
            [">", "GT", "Greater than"],
            ["<", "LT", "Less than"],
            [">=", "GE", "Greater than or equal to"],
            ["<=", "LE", "Less than or equal to"],
          ],
        },
        {
          type: "comparison_table",
          title: "Special condition checks in the deck",
          columns: ["Keyword", "Meaning"],
          rows: [
            ["IS INITIAL", "Variable still has its default initial value"],
            ["IS NOT INITIAL", "Variable has been assigned a non-initial value"],
            ["IS BOUND", "Reference variable points to an object"],
            ["IS SUPPLIED", "Optional method parameter was actually passed"],
            ["BETWEEN x AND y", "Value lies inside an inclusive range"],
            ["IN selection_table", "Value matches a selection-range table"],
          ],
        },
        {
          type: "callout",
          tone: "warning",
          title: "Clean ABAP tip from the slide",
          text:
            "Avoid deeply nested IF blocks. Once nesting grows beyond one or two levels, extract inner logic into a method so the flow stays readable.",
        },
      ],
    },
    {
      id: "case",
      title: "CASE Statement",
      intro:
        "The *CASE* slide presents multi-way branching based on a single variable value. It is a cleaner fit than long IF chains when the program is selecting among a known set of alternatives.",
      blocks: [
        {
          type: "bullet_list",
          title: "CASE behavior highlighted in the deck",
          items: [
            "*WHEN OTHERS* acts as the default branch and is strongly recommended.",
            "A single *WHEN* can match multiple values.",
            "ABAP CASE has *no fall-through* unlike some other languages.",
            "Every CASE block must end with *ENDCASE*.",
          ],
        },
        {
          type: "paragraph",
          text:
            "The practical example in the deck uses a student grade variable to map values such as `A`, `B`, `C`, or `D` into readable result messages. This demonstrates where CASE becomes more expressive than repeating the same compared variable in several IF branches.",
        },
        {
          type: "paragraph",
          text:
            "As a style rule, CASE is especially useful when the code is making a clean business classification: status to label, code to meaning, category to action, or option to output.",
        },
      ],
    },
    {
      id: "loops",
      title: "LOOP, DO, and WHILE",
      intro:
        "The next group of slides covers table iteration and repetition. The deck separates *LOOP AT* for internal-table processing from *DO* and *WHILE* for repeated execution.",
      blocks: [
        {
          type: "bullet_list",
          title: "LOOP AT patterns from the presentation",
          items: [
            "*Basic LOOP* reads every row in order.",
            "*LOOP ... WHERE* filters rows during iteration.",
            "*LOOP ... FROM ... TO* restricts processing to a row range.",
            "*LOOP ... ASSIGNING FIELD-SYMBOL(<ls>)* processes rows by reference for direct modification.",
          ],
        },
        {
          type: "bullet_list",
          title: "Loop-control helpers",
          items: [
            "*SY-TABIX* stores the current 1-based loop row index.",
            "*CONTINUE* skips the rest of the current iteration and jumps to the next row.",
            "*SY-INDEX* stores the current repetition count in DO and related loop contexts.",
          ],
        },
        {
          type: "comparison_table",
          title: "DO vs WHILE from the deck",
          columns: ["Aspect", "DO", "WHILE"],
          rows: [
            ["Best when", "Number of iterations is known upfront", "A condition determines when to stop"],
            ["Counter", "Uses SY-INDEX automatically", "Usually requires a manual counter variable"],
            ["Execution behavior", "Can run a fixed number of times", "May not execute at all if the condition is false initially"],
            ["Infinite-loop form", "DO without TIMES needs EXIT", "WHILE with always-true condition needs EXIT"],
          ],
        },
        {
          type: "paragraph",
          text:
            "Taken together, these loop forms let ABAP developers choose the right iteration style for the problem: table traversal, fixed repetition, or condition-driven repetition.",
        },
      ],
    },
    {
      id: "inline",
      title: "Inline Declarations",
      intro:
        "One of the most modern topics in the deck is *inline declaration*. The idea is simple: declare variables exactly where they are first used instead of predeclaring everything at the top of the method.",
      blocks: [
        {
          type: "card_grid",
          title: "Why the deck recommends inline declarations",
          items: [
            { title: "Less Code", text: "No need to collect every declaration at the top before the logic begins." },
            { title: "Type Safety", text: "Type can be inferred from the right-hand side or surrounding ABAP statement." },
            { title: "Readability", text: "The variable appears right where it becomes relevant to the reader." },
            { title: "Scope Control", text: "The variable stays closer to the block where it is actually needed." },
          ],
        },
        {
          type: "bullet_list",
          title: "Practical inline-usage scenarios from the slides",
          items: [
            "*SELECT ... INTO TABLE @DATA(itab)*",
            "*LOOP AT itab INTO DATA(ls_row)*",
            "*READ TABLE itab ... INTO DATA(ls_found)*",
            "*CALL METHOD ... IMPORTING ev_name = DATA(lv_name)*",
            "*LOOP AT itab ASSIGNING FIELD-SYMBOL(<ls_row>)*",
          ],
        },
        {
          type: "bullet_list",
          title: "Rules and limitations called out in the deck",
          items: [
            "Available in *ABAP 7.40 or higher*.",
            "Useful for local variables, not for class attributes.",
            "Do not redeclare the same variable name again in the same scope.",
            "Not supported in every older statement form such as classic `MOVE` or some FORM-based patterns.",
          ],
        },
      ],
    },
    {
      id: "clean-abap",
      title: "Clean ABAP",
      intro:
        "The Clean ABAP part of the PPT focuses on naming quality, clarity, and modern expression style. It is less about making the code shorter and more about making intent obvious to the next person reading it.",
      blocks: [
        {
          type: "comparison_table",
          title: "Naming prefixes from the deck",
          columns: ["Prefix", "Typical Meaning", "Examples"],
          rows: [
            ["lv_", "Local scalar variable", "lv_name, lv_count"],
            ["ls_", "Local structure", "ls_employee, ls_order"],
            ["lt_", "Local internal table", "lt_employees, lt_items"],
            ["lr_", "Local reference", "lr_object, lr_class"],
            ["gv_ / gs_ / gt_", "Global variable, structure, or table", "gv_flag, gs_header, gt_data"],
            ["iv_ / ev_ / cv_ / rv_", "Import, export, changing, and return parameters", "iv_id, ev_name, cv_total, rv_result"],
            ["c_", "Constant", "c_max, c_status_open"],
          ],
        },
        {
          type: "bullet_list",
          title: "Name quality rules from the presentation",
          items: [
            "Avoid vague one-letter names such as `lv_x`.",
            "Prefer descriptive business names such as `lv_employee_count`.",
            "Use meaningful boolean names like `lv_is_active`.",
            "Avoid unclear abbreviations where the domain meaning is lost.",
            "Name methods with a *verb + noun* style such as `calculate_tax`.",
          ],
        },
        {
          type: "comparison_table",
          title: "Do and don't patterns from the deck",
          columns: ["Area", "Older Style", "Cleaner Style"],
          rows: [
            ["String building", "CONCATENATE ... INTO ...", "String template syntax such as `|{ lv_first } { lv_last }|`"],
            ["Boolean check", "Compare to raw flag character", "Compare to `abap_true` with meaningful variable names"],
            ["Object creation", "CREATE OBJECT ...", "Inline `NEW ...` construction"],
            ["Table read", "READ TABLE + IF sy-subrc <> 0", "Inline read + `CHECK sy-subrc = 0` where appropriate"],
          ],
        },
      ],
    },
    {
      id: "syntax",
      title: "Old vs New Syntax",
      intro:
        "The *ABAP Syntax Comparison* slide ties Day 3 together by contrasting older ABAP idioms with the newer 7.4+ style. This is especially useful for learners who may encounter both styles in real SAP projects.",
      blocks: [
        {
          type: "card_grid",
          items: [
            { title: "Data Declaration", text: "Classic explicit declarations at the top can often be replaced with inline `DATA(...)` assignments." },
            { title: "Internal Table Creation", text: "Modern ABAP can use `VALUE` expressions and inline table construction instead of stepwise fill patterns." },
            { title: "SELECT Syntax", text: "Newer syntax uses comma-separated fields and `@` escaping for host variables." },
            { title: "Data Mapping", text: "`CORRESPONDING #( ... )` can replace longer move-corresponding loops in many scenarios." },
            { title: "Existence Check", text: "`line_exists( ... )` provides a compact way to test whether a row is present." },
          ],
        },
        {
          type: "paragraph",
          text:
            "The practical takeaway is not that old syntax is impossible to maintain, but that modern syntax often communicates intent more directly. The cleaner the code reads, the easier it becomes to review, extend, and debug.",
        },
      ],
    },
    {
      id: "summary",
      title: "Module Summary",
      intro:
        "The summary slide compresses the whole module into a quick revision grid. It reinforces that Day 3 is a mixed session covering both syntax and style.",
      blocks: [
        {
          type: "card_grid",
          items: [
            { title: "Structures, Work Areas, and Internal Tables", text: "Core data containers for grouping fields and handling single-row and multi-row processing." },
            { title: "IF Statement", text: "Conditional branching with comparison operators and checks such as `IS INITIAL`." },
            { title: "CASE Statement", text: "Multi-value branching with `WHEN` and `WHEN OTHERS`, without fall-through." },
            { title: "LOOP AT", text: "Controlled iteration across internal tables with `WHERE`, ranges, and field symbols." },
            { title: "DO and WHILE", text: "Fixed-count and condition-driven repetition strategies." },
            { title: "Inline Declarations", text: "Type-safe point-of-use variable declarations for modern ABAP style." },
            { title: "Clean ABAP", text: "Meaningful names, shorter methods, modern syntax, and fewer magic values." },
          ],
        },
      ],
    },
    {
      id: "exercises",
      title: "Exercises",
      intro:
        "The closing exercise slides ask learners to apply the full range of Day 3 concepts, from structure creation and loops to control statements and internal-table operations.",
      blocks: [
        {
          type: "bullet_list",
          title: "Exercise 1: Structure and work area",
          items: [
            "Create a structure called *STUDENT* with fields *ID* (Integer), *NAME* (String), and *MARKS* (Integer).",
            "Declare a work area using that structure.",
            "Assign values such as `ID = 101`, `NAME = 'Rahul'`, and `MARKS = 85`.",
            "Display the values using *WRITE*.",
          ],
        },
        {
          type: "bullet_list",
          title: "Exercise 2: Internal table and loop",
          items: [
            "Create an internal table to store student data or student names.",
            "Insert entries such as `Ravi`, `Priya`, and `Kiran`.",
            "Use a *LOOP* statement to display all rows.",
          ],
        },
        {
          type: "bullet_list",
          title: "Exercise 3: IF statement",
          items: [
            "Declare a `marks` variable using inline declaration and assign `60`.",
            "If `marks >= 50`, display *Student Passed*.",
            "Otherwise, display *Student Failed*.",
          ],
        },
        {
          type: "bullet_list",
          title: "Exercise 4: CASE statement",
          items: [
            "Declare a `day` variable and assign `3`.",
            "Use *CASE* to map `1 -> Monday`, `2 -> Tuesday`, `3 -> Wednesday`, `4 -> Thursday`.",
            "Use *WHEN OTHERS* to display *Invalid Day* for all unmatched values.",
          ],
        },
        {
          type: "bullet_list",
          title: "Exercise 5: Internal-table operations",
          items: [
            "Explain and write down the syntax for *APPEND*.",
            "Explain and write down the syntax for *READ*.",
            "Explain and write down the syntax for *DELETE ADJACENT*.",
            "Explain and write down the syntax for *SORT*.",
          ],
        },
      ],
    },
  ],
};

export const DAY_ONE_SEED_PAYLOAD = {
  name: "DevCon Campus Edition - Day 1 Foundations",
  description:
    "Detailed Day 1 course content covering ERP, SAP, ABAP foundations, consultant roles, architecture, data dictionary, SELECT statements, modularization, forms, and IDocs.",
  contentJson: DAY_ONE_LESSON,
};

export function getDefaultLessonContent(dayNumber: number): LessonContent {
  if (dayNumber === 2) {
    return DAY_TWO_LESSON;
  }
  if (dayNumber === 3) {
    return DAY_THREE_LESSON;
  }
  return DAY_ONE_LESSON;
}

export function normalizeLessonContent(material: CourseMaterialRecord): LessonContent | null {
  if (material.contentType !== "lesson") {
    return null;
  }

  const payload = material.contentJson;
  const defaultLesson = getDefaultLessonContent(material.dayNumber);
  if (!payload || typeof payload !== "object") {
    return defaultLesson;
  }

  const partial = payload as Partial<LessonContent> & {
    hero?: Partial<LessonContent["hero"]>;
    toc?: LessonContent["toc"];
    sections?: LessonContent["sections"];
  };

  // Older saved course records used an earlier text-heavy Day 1 payload.
  // Force them onto the latest image-rich static page.
  if (typeof partial.version !== "number" || partial.version < defaultLesson.version) {
    return defaultLesson;
  }

  return {
    version: typeof partial.version === "number" ? partial.version : defaultLesson.version,
    slug: partial.slug || defaultLesson.slug,
    hero: {
      title: partial.hero?.title || defaultLesson.hero.title,
      subtitle: partial.hero?.subtitle || defaultLesson.hero.subtitle,
    },
    toc: Array.isArray(partial.toc) && partial.toc.length > 0 ? partial.toc : defaultLesson.toc,
    sections: Array.isArray(partial.sections) && partial.sections.length > 0 ? partial.sections : defaultLesson.sections,
  };
}

export function renderRichText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={`${part}-${index}`}>{part.slice(1, -1)}</em>;
    }
    return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
  });
}
