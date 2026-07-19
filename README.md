# Shine Assessment & Learning Platform

Integrated learning, assessment, candidate management, and onboarding platform designed to streamline the complete candidate journey from registration to evaluation and offer generation.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Flask](https://img.shields.io/badge/Flask-Python-black?logo=flask)
![MongoDB](https://img.shields.io/badge/MongoDB-Database-47A248?logo=mongodb)
![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED?logo=docker)

![Status](https://img.shields.io/badge/Status-Production_Ready-success)
![Architecture](https://img.shields.io/badge/Architecture-Full_Stack-blue)
![Type](https://img.shields.io/badge/Project-LMS_&_Assessment-purple)

---

## Overview

Shine is a comprehensive platform that combines online assessments, learning management, candidate administration, analytics, and document generation into a single system.

The platform enables organizations to onboard candidates, deliver structured learning content, conduct assessments, monitor performance, and automate post-evaluation workflows through a centralized portal.

---

## Core Capabilities

### Candidate Lifecycle Management

* Self-registration portal
* Candidate onboarding workflows
* Academic profile management
* User account administration
* Candidate database management

### Learning Management

* Course creation and management
* Day-wise learning material delivery
* Candidate course assignments
* Structured content organization
* Learning resource administration

### Assessment Engine

* Online examination platform
* Multi-section assessments
* Timed examinations
* Auto-save functionality
* Resume interrupted attempts
* Automated scoring and evaluation

### Test Administration

* Test creation and publishing
* Question bank management
* Multiple question formats
* Candidate assignment workflows
* Bulk assignment capabilities

### Performance Analytics

* Candidate performance tracking
* Pass/fail analysis
* Section-wise scoring
* Test performance reports
* Historical attempt analysis

### Document Automation

* Automated offer letter generation
* Dynamic PDF creation
* Candidate-specific document templates
* Downloadable onboarding documents

---

## User Roles

### Administrator

Manage:

* Candidates
* Courses
* Assessments
* Assignments
* Analytics
* Offer Letter Generation
* Master Data Configuration

### Candidate

Access:

* Assigned Courses
* Learning Materials
* Assessments
* Test Results
* Performance History
* Generated Documents

---

## Key Features

### Registration & User Management

* Self-service registration
* Unique candidate ID generation
* Academic profile tracking
* Account activation and deactivation
* Password management and resets

### Assessment Features

* Multiple Choice Questions (MCQ)
* Multi-Select Questions
* Text-Based Questions
* Question Review Flags
* Automatic Submission
* Section-Based Navigation

### Results & Analytics

* Instant score calculation
* Pass/fail evaluation
* Question-level analysis
* Section-wise breakdown
* Historical performance trends
* Exportable reports

### Learning Platform

* Course assignment workflows
* Day-wise content delivery
* Learning progress visibility
* Structured curriculum management

### Offer Letter Automation

* Candidate-specific templates
* Dynamic data population
* PDF generation
* Downloadable offer letters

---

## Platform Statistics

### User Types

* Administrator
* Candidate

### Major Modules

* Registration Management
* User Management
* Learning Management
* Assessment Engine
* Analytics Dashboard
* Results Management
* Offer Letter Generation
* Master Data Management

---

## Business Value

EMAX LMS centralizes learning, assessments, candidate records, and onboarding workflows into a single platform, reducing administrative effort while improving visibility into candidate performance and recruitment outcomes.

Organizations can manage the entire candidate journey without relying on multiple disconnected systems.

---

## Technology Stack

### Frontend

* React
* TypeScript
* React Router DOM
* Create React App (`react-scripts`)
* Native Fetch API

### Backend

* Python 3.11
* Flask
* Flask-CORS
* Gunicorn

### Database

* MongoDB
* PyMongo

### Scheduling & Background Services

* APScheduler
* Python DateUtil

### Configuration & Environment Management

* Python Dotenv

### External Communication

* Requests

### Document Processing

* LibreOffice Runtime Integration
* PDF Generation Workflows
* Offer Letter Automation

### Infrastructure & Deployment

* Docker
* Docker Compose

### Development Architecture

```text
React + TypeScript Frontend
            │
            ▼
      Flask REST APIs
            │
            ▼
        MongoDB
```

---

## Technical Highlights

* Role-Based User Management
* Candidate Self-Registration
* Assessment Engine with Auto-Evaluation
* Resume-Attempt Functionality
* Course & Learning Management
* Offer Letter Generation Pipeline
* Analytics & Reporting Dashboard
* Dockerized Multi-Service Deployment

---

## Architecture Overview

The platform follows a modern client-server architecture:

* React + TypeScript powers the candidate and administrator interfaces
* Flask provides backend APIs and business logic
* MongoDB stores candidate, assessment, course, and analytics data
* APScheduler handles background jobs and scheduled processes
* Docker Compose orchestrates frontend and backend services
* Gunicorn serves the Flask application in production environments

---

### Stack Summary

**React + TypeScript + Flask + MongoDB + Docker**

A full-stack assessment and learning platform built for scalability, maintainability, and enterprise deployment.
