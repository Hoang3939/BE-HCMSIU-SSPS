-- =============================================
-- Database Schema for HCMSIU-SSPS
-- Part 1: Tables, Indexes, Triggers, Views
-- SQL Server Script
-- =============================================

USE master;
GO

-- Tạo database nếu chưa tồn tại
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'HCMSIU_SSPS')
BEGIN
    CREATE DATABASE HCMSIU_SSPS;
END
GO

USE HCMSIU_SSPS;
GO

-- =============================================
-- 1. USER MANAGEMENT TABLES
-- =============================================

-- Bảng Users (Bảng chính)
IF OBJECT_ID('Users', 'U') IS NOT NULL
    DROP TABLE Users;
GO

CREATE TABLE Users (
    UserID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Username NVARCHAR(100) NOT NULL UNIQUE,
    Email NVARCHAR(255) NOT NULL UNIQUE,
    Role NVARCHAR(20) NOT NULL CHECK (Role IN ('STUDENT', 'ADMIN', 'SPSO')),
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    LastLogin DATETIME NULL,
    IsActive BIT NOT NULL DEFAULT 1
);
GO

CREATE INDEX IX_Users_Username ON Users(Username);
CREATE INDEX IX_Users_Email ON Users(Email);
CREATE INDEX IX_Users_Role ON Users(Role);
GO

-- Bảng Students
IF OBJECT_ID('Students', 'U') IS NOT NULL
    DROP TABLE Students;
GO

CREATE TABLE Students (
    StudentID UNIQUEIDENTIFIER PRIMARY KEY,
    StudentCode NVARCHAR(50) NOT NULL UNIQUE,
    Semester NVARCHAR(20) NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Students_Users FOREIGN KEY (StudentID) 
        REFERENCES Users(UserID) ON DELETE CASCADE
);
GO

CREATE INDEX IX_Students_StudentCode ON Students(StudentCode);
GO

-- Bảng Admins
IF OBJECT_ID('Admins', 'U') IS NOT NULL
    DROP TABLE Admins;
GO

CREATE TABLE Admins (
    AdminID UNIQUEIDENTIFIER PRIMARY KEY,
    Role NVARCHAR(50) NULL,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Admins_Users FOREIGN KEY (AdminID) 
        REFERENCES Users(UserID) ON DELETE CASCADE
);
GO

-- Bảng Sessions
IF OBJECT_ID('Sessions', 'U') IS NOT NULL
    DROP TABLE Sessions;
GO

CREATE TABLE Sessions (
    SessionID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    UserID UNIQUEIDENTIFIER NOT NULL,
    Token NVARCHAR(MAX) NOT NULL,
    RefreshToken NVARCHAR(MAX) NULL,
    ExpiresAt DATETIME NOT NULL,
    LastActivity DATETIME NOT NULL DEFAULT GETDATE(),
    IPAddress NVARCHAR(50) NULL,
    UserAgent NVARCHAR(MAX) NULL,
    CONSTRAINT FK_Sessions_Users FOREIGN KEY (UserID) 
        REFERENCES Users(UserID) ON DELETE CASCADE
);
GO

-- Tạo indexes cho Sessions (drop nếu đã tồn tại)
-- Lưu ý: Không thể index trên Token vì nó là NVARCHAR(MAX)
-- Nếu cần tìm kiếm theo Token, có thể tạo computed column với hash

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Sessions_UserID' AND object_id = OBJECT_ID('Sessions'))
    DROP INDEX IX_Sessions_UserID ON Sessions;
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Sessions_ExpiresAt' AND object_id = OBJECT_ID('Sessions'))
    DROP INDEX IX_Sessions_ExpiresAt ON Sessions;
GO

-- Tạo index trên UserID và ExpiresAt
CREATE INDEX IX_Sessions_UserID ON Sessions(UserID);
CREATE INDEX IX_Sessions_ExpiresAt ON Sessions(ExpiresAt);

-- Nếu cần tìm kiếm theo Token, có thể tạo computed column với hash
-- Ví dụ: ALTER TABLE Sessions ADD TokenHash AS CHECKSUM(Token) PERSISTED;
-- Sau đó tạo index: CREATE INDEX IX_Sessions_TokenHash ON Sessions(TokenHash);
GO

-- Bảng Permissions
IF OBJECT_ID('Permissions', 'U') IS NOT NULL
    DROP TABLE Permissions;
GO

CREATE TABLE Permissions (
    PermissionID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Name NVARCHAR(100) NOT NULL UNIQUE,
    Resource NVARCHAR(100) NOT NULL,
    Action NVARCHAR(50) NOT NULL
);
GO

-- Bảng UserPermissions (Many-to-Many)
IF OBJECT_ID('UserPermissions', 'U') IS NOT NULL
    DROP TABLE UserPermissions;
GO

CREATE TABLE UserPermissions (
    UserID UNIQUEIDENTIFIER NOT NULL,
    PermissionID UNIQUEIDENTIFIER NOT NULL,
    PRIMARY KEY (UserID, PermissionID),
    CONSTRAINT FK_UserPermissions_Users FOREIGN KEY (UserID) 
        REFERENCES Users(UserID) ON DELETE CASCADE,
    CONSTRAINT FK_UserPermissions_Permissions FOREIGN KEY (PermissionID) 
        REFERENCES Permissions(PermissionID) ON DELETE CASCADE
);
GO

-- =============================================
-- 2. PRINTING TABLES
-- =============================================

-- Bảng PrinterLocations
IF OBJECT_ID('PrinterLocations', 'U') IS NOT NULL
    DROP TABLE PrinterLocations;
GO

CREATE TABLE PrinterLocations (
    LocationID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Campus NVARCHAR(100) NOT NULL,
    Building NVARCHAR(100) NOT NULL,
    Room NVARCHAR(50) NOT NULL,
    Floor INT NOT NULL,
    MapX FLOAT NULL,
    MapY FLOAT NULL
);
GO

-- Bảng CampusMaps
IF OBJECT_ID('CampusMaps', 'U') IS NOT NULL
    DROP TABLE CampusMaps;
GO

CREATE TABLE CampusMaps (
    MapID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Building NVARCHAR(100) NOT NULL,
    Floor INT NOT NULL,
    MapImage NVARCHAR(MAX) NULL,
    Scale FLOAT NULL DEFAULT 1.0,
    Width INT NULL,
    Height INT NULL,
    UNIQUE (Building, Floor)
);
GO

-- Bảng Printers
IF OBJECT_ID('Printers', 'U') IS NOT NULL
    DROP TABLE Printers;
GO

CREATE TABLE Printers (
    PrinterID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    Name NVARCHAR(100) NOT NULL,
    Brand NVARCHAR(50) NULL,
    Model NVARCHAR(50) NULL,
    Description NVARCHAR(MAX) NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'OFFLINE' 
        CHECK (Status IN ('AVAILABLE', 'BUSY', 'OFFLINE', 'MAINTENANCE', 'ERROR')),
    IPAddress NVARCHAR(50) NULL,
    CUPSPrinterName NVARCHAR(100) NULL,
    LocationID UNIQUEIDENTIFIER NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Printers_PrinterLocations FOREIGN KEY (LocationID) 
        REFERENCES PrinterLocations(LocationID) ON DELETE SET NULL
);
GO

CREATE INDEX IX_Printers_Status ON Printers(Status);
CREATE INDEX IX_Printers_LocationID ON Printers(LocationID);
GO

-- Bảng MapLocations
IF OBJECT_ID('MapLocations', 'U') IS NOT NULL
    DROP TABLE MapLocations;
GO

CREATE TABLE MapLocations (
    MapLocationID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    PrinterID UNIQUEIDENTIFIER NOT NULL UNIQUE,
    X FLOAT NOT NULL,
    Y FLOAT NOT NULL,
    Floor INT NOT NULL,
    Building NVARCHAR(100) NOT NULL,
    Room NVARCHAR(50) NOT NULL,
    Description NVARCHAR(MAX) NULL,
    CONSTRAINT FK_MapLocations_Printers FOREIGN KEY (PrinterID) 
        REFERENCES Printers(PrinterID) ON DELETE CASCADE
);
GO

CREATE INDEX IX_MapLocations_PrinterID ON MapLocations(PrinterID);
CREATE INDEX IX_MapLocations_Floor ON MapLocations(Floor, Building);
GO

-- Bảng Documents
IF OBJECT_ID('Documents', 'U') IS NOT NULL
    DROP TABLE Documents;
GO

CREATE TABLE Documents (
    DocID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    FileName NVARCHAR(255) NOT NULL,
    FileType NVARCHAR(50) NOT NULL,
    FileSize BIGINT NOT NULL,
    FilePath NVARCHAR(MAX) NOT NULL,
    StudentID UNIQUEIDENTIFIER NOT NULL,
    UploadedAt DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_Documents_Students FOREIGN KEY (StudentID) 
        REFERENCES Students(StudentID) ON DELETE CASCADE
);
GO

CREATE INDEX IX_Documents_StudentID ON Documents(StudentID);
CREATE INDEX IX_Documents_FileType ON Documents(FileType);
GO

-- Bảng PrintConfigs
IF OBJECT_ID('PrintConfigs', 'U') IS NOT NULL
    DROP TABLE PrintConfigs;
GO

CREATE TABLE PrintConfigs (
    ConfigID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    PaperSize NVARCHAR(20) NOT NULL 
        CHECK (PaperSize IN ('A4', 'A3', 'LETTER', 'LEGAL')),
    Copies INT NOT NULL DEFAULT 1 CHECK (Copies > 0),
    IsColor BIT NOT NULL DEFAULT 0,
    IsDoubleSided BIT NOT NULL DEFAULT 0,
    PageRange NVARCHAR(100) NULL,
    Orientation NVARCHAR(20) NULL DEFAULT 'PORTRAIT' 
        CHECK (Orientation IN ('PORTRAIT', 'LANDSCAPE'))
);
GO

-- Bảng PrintJobs
IF OBJECT_ID('PrintJobs', 'U') IS NOT NULL
    DROP TABLE PrintJobs;
GO

CREATE TABLE PrintJobs (
    JobID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    StudentID UNIQUEIDENTIFIER NOT NULL,
    PrinterID UNIQUEIDENTIFIER NOT NULL,
    DocumentID UNIQUEIDENTIFIER NOT NULL,
    ConfigID UNIQUEIDENTIFIER NOT NULL,
    CUPSJobID INT NULL,
    CUPSPrinterName NVARCHAR(100) NULL,
    StartTime DATETIME NOT NULL DEFAULT GETDATE(),
    EndTime DATETIME NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (Status IN ('PENDING', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED')),
    TotalPages INT NOT NULL CHECK (TotalPages > 0),
    Cost DECIMAL(10,2) NOT NULL DEFAULT 0,
    ErrorMessage NVARCHAR(MAX) NULL,
    CUPSStatus NVARCHAR(50) NULL,
    IsRefunded BIT NOT NULL DEFAULT 0,
    QueuePosition INT NULL,
    CONSTRAINT FK_PrintJobs_Students FOREIGN KEY (StudentID) 
        REFERENCES Students(StudentID) ON DELETE CASCADE,
    CONSTRAINT FK_PrintJobs_Printers FOREIGN KEY (PrinterID) 
        REFERENCES Printers(PrinterID) ON DELETE CASCADE,
    -- Sử dụng NO ACTION để tránh multiple cascade paths
    -- Khi xóa Document, PrintJob vẫn giữ lại để lưu lịch sử
    CONSTRAINT FK_PrintJobs_Documents FOREIGN KEY (DocumentID) 
        REFERENCES Documents(DocID) ON DELETE NO ACTION,
    CONSTRAINT FK_PrintJobs_PrintConfigs FOREIGN KEY (ConfigID) 
        REFERENCES PrintConfigs(ConfigID) ON DELETE CASCADE
);
GO

CREATE INDEX IX_PrintJobs_StudentID ON PrintJobs(StudentID);
CREATE INDEX IX_PrintJobs_PrinterID ON PrintJobs(PrinterID);
CREATE INDEX IX_PrintJobs_Status ON PrintJobs(Status);
CREATE INDEX IX_PrintJobs_StartTime ON PrintJobs(StartTime);
CREATE INDEX IX_PrintJobs_CUPSJobID ON PrintJobs(CUPSJobID);
GO

-- Bảng PrintLogs
IF OBJECT_ID('PrintLogs', 'U') IS NOT NULL
    DROP TABLE PrintLogs;
GO

CREATE TABLE PrintLogs (
    LogID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    StudentID UNIQUEIDENTIFIER NOT NULL,
    PrinterID UNIQUEIDENTIFIER NOT NULL,
    JobID UNIQUEIDENTIFIER NOT NULL UNIQUE,
    FileName NVARCHAR(255) NOT NULL,
    StartTime DATETIME NOT NULL,
    EndTime DATETIME NULL,
    TotalPages INT NOT NULL,
    Cost DECIMAL(10,2) NOT NULL,
    Status NVARCHAR(50) NOT NULL,
    CONSTRAINT FK_PrintLogs_Students FOREIGN KEY (StudentID) 
        REFERENCES Students(StudentID) ON DELETE CASCADE,
    CONSTRAINT FK_PrintLogs_Printers FOREIGN KEY (PrinterID) 
        REFERENCES Printers(PrinterID) ON DELETE CASCADE,
    -- Sử dụng NO ACTION để tránh multiple cascade paths
    -- PrintLogs là lịch sử, cần giữ lại ngay cả khi PrintJob bị xóa
    CONSTRAINT FK_PrintLogs_PrintJobs FOREIGN KEY (JobID) 
        REFERENCES PrintJobs(JobID) ON DELETE NO ACTION
);
GO

CREATE INDEX IX_PrintLogs_StudentID ON PrintLogs(StudentID);
CREATE INDEX IX_PrintLogs_PrinterID ON PrintLogs(PrinterID);
CREATE INDEX IX_PrintLogs_StartTime ON PrintLogs(StartTime);
GO

-- Bảng PrintLogPages (Chi tiết số trang theo khổ giấy)
IF OBJECT_ID('PrintLogPages', 'U') IS NOT NULL
    DROP TABLE PrintLogPages;
GO

CREATE TABLE PrintLogPages (
    LogPageID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    LogID UNIQUEIDENTIFIER NOT NULL,
    PaperSize NVARCHAR(20) NOT NULL,
    PageCount INT NOT NULL CHECK (PageCount > 0),
    CONSTRAINT FK_PrintLogPages_PrintLogs FOREIGN KEY (LogID) 
        REFERENCES PrintLogs(LogID) ON DELETE CASCADE
);
GO

CREATE INDEX IX_PrintLogPages_LogID ON PrintLogPages(LogID);
GO

-- =============================================
-- 3. PAYMENT TABLES
-- =============================================

-- Bảng PageBalances
IF OBJECT_ID('PageBalances', 'U') IS NOT NULL
    DROP TABLE PageBalances;
GO

CREATE TABLE PageBalances (
    BalanceID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    StudentID UNIQUEIDENTIFIER NOT NULL UNIQUE,
    CurrentBalance INT NOT NULL DEFAULT 0 CHECK (CurrentBalance >= 0),
    DefaultPages INT NOT NULL DEFAULT 0,
    PurchasedPages INT NOT NULL DEFAULT 0,
    UsedPages INT NOT NULL DEFAULT 0,
    Semester NVARCHAR(20) NULL,
    LastUpdated DATETIME NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_PageBalances_Students FOREIGN KEY (StudentID) 
        REFERENCES Students(StudentID) ON DELETE CASCADE
);
GO

CREATE INDEX IX_PageBalances_StudentID ON PageBalances(StudentID);
GO

-- Bảng Transactions
IF OBJECT_ID('Transactions', 'U') IS NOT NULL
    DROP TABLE Transactions;
GO

CREATE TABLE Transactions (
    TransID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    StudentID UNIQUEIDENTIFIER NOT NULL,
    Date DATETIME NOT NULL DEFAULT GETDATE(),
    Amount DECIMAL(10,2) NOT NULL CHECK (Amount >= 0),
    PagesAdded INT NOT NULL CHECK (PagesAdded > 0),
    Status NVARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (Status IN ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED')),
    PaymentMethod NVARCHAR(50) NULL,
    PaymentRef NVARCHAR(255) NULL,
    CONSTRAINT FK_Transactions_Students FOREIGN KEY (StudentID) 
        REFERENCES Students(StudentID) ON DELETE CASCADE
);
GO

CREATE INDEX IX_Transactions_StudentID ON Transactions(StudentID);
CREATE INDEX IX_Transactions_Date ON Transactions(Date);
CREATE INDEX IX_Transactions_Status ON Transactions(Status);
GO

-- =============================================
-- 4. CONFIGURATION TABLES
-- =============================================

-- Bảng SystemConfigs
IF OBJECT_ID('SystemConfigs', 'U') IS NOT NULL
    DROP TABLE SystemConfigs;
GO

CREATE TABLE SystemConfigs (
    ConfigID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    DefaultPagePrice DECIMAL(10,2) NOT NULL DEFAULT 0,
    DefaultPagesPerSemester INT NOT NULL DEFAULT 0,
    AllowedFileTypes NVARCHAR(MAX) NULL, -- JSON array: ["pdf", "docx", ...]
    MaxFileSize BIGINT NOT NULL DEFAULT 10485760, -- 10MB default
    A4ToA3Ratio FLOAT NOT NULL DEFAULT 2.0,
    PagePackages NVARCHAR(MAX) NULL, -- JSON object: {"100": 20000, "200": 35000}
    SemesterStartDate DATETIME NULL,
    SemesterEndDate DATETIME NULL,
    AutoResetDate DATETIME NULL,
    UpdatedAt DATETIME NOT NULL DEFAULT GETDATE()
);
GO

-- Bảng Reports
IF OBJECT_ID('Reports', 'U') IS NOT NULL
    DROP TABLE Reports;
GO

CREATE TABLE Reports (
    ReportID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ReportType NVARCHAR(20) NOT NULL 
        CHECK (ReportType IN ('MONTHLY', 'YEARLY', 'CUSTOM')),
    Period NVARCHAR(50) NULL,
    StartDate DATETIME NOT NULL,
    EndDate DATETIME NOT NULL,
    GeneratedAt DATETIME NOT NULL DEFAULT GETDATE(),
    GeneratedBy UNIQUEIDENTIFIER NULL,
    FilePath NVARCHAR(MAX) NULL,
    CONSTRAINT FK_Reports_Admins FOREIGN KEY (GeneratedBy) 
        REFERENCES Admins(AdminID) ON DELETE SET NULL
);
GO

CREATE INDEX IX_Reports_GeneratedBy ON Reports(GeneratedBy);
CREATE INDEX IX_Reports_ReportType ON Reports(ReportType);
CREATE INDEX IX_Reports_StartDate ON Reports(StartDate);
GO

-- Bảng ReportData
IF OBJECT_ID('ReportData', 'U') IS NOT NULL
    DROP TABLE ReportData;
GO

CREATE TABLE ReportData (
    ReportDataID UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    ReportID UNIQUEIDENTIFIER NOT NULL UNIQUE,
    TotalJobs INT NOT NULL DEFAULT 0,
    TotalPages INT NOT NULL DEFAULT 0,
    Revenue DECIMAL(10,2) NOT NULL DEFAULT 0,
    DataJSON NVARCHAR(MAX) NULL, -- JSON cho pagesBySize, jobsByPrinter, jobsByStudent
    CONSTRAINT FK_ReportData_Reports FOREIGN KEY (ReportID) 
        REFERENCES Reports(ReportID) ON DELETE CASCADE
);
GO

-- =============================================
-- 5. TRIGGERS
-- =============================================

-- Trigger để tự động cập nhật UpdatedAt cho Printers
IF OBJECT_ID('TR_Printers_UpdateTimestamp', 'TR') IS NOT NULL
    DROP TRIGGER TR_Printers_UpdateTimestamp;
GO

CREATE TRIGGER TR_Printers_UpdateTimestamp
ON Printers
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE Printers
    SET UpdatedAt = GETDATE()
    WHERE PrinterID IN (SELECT PrinterID FROM inserted);
END;
GO

-- Trigger để tự động cập nhật LastUpdated cho PageBalances
IF OBJECT_ID('TR_PageBalances_UpdateTimestamp', 'TR') IS NOT NULL
    DROP TRIGGER TR_PageBalances_UpdateTimestamp;
GO

CREATE TRIGGER TR_PageBalances_UpdateTimestamp
ON PageBalances
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE PageBalances
    SET LastUpdated = GETDATE()
    WHERE BalanceID IN (SELECT BalanceID FROM inserted);
END;
GO

-- =============================================
-- 6. VIEWS (Optional - để query dễ dàng hơn)
-- =============================================

-- View: Student với PageBalance
IF OBJECT_ID('VW_StudentBalance', 'V') IS NOT NULL
    DROP VIEW VW_StudentBalance;
GO

CREATE VIEW VW_StudentBalance
AS
SELECT 
    s.StudentID,
    u.Username,
    u.Email,
    s.StudentCode,
    s.Semester,
    pb.CurrentBalance,
    pb.DefaultPages,
    pb.PurchasedPages,
    pb.UsedPages,
    pb.LastUpdated
FROM Students s
INNER JOIN Users u ON s.StudentID = u.UserID
LEFT JOIN PageBalances pb ON s.StudentID = pb.StudentID;
GO

-- View: PrintJob với thông tin đầy đủ
IF OBJECT_ID('VW_PrintJobDetails', 'V') IS NOT NULL
    DROP VIEW VW_PrintJobDetails;
GO

CREATE VIEW VW_PrintJobDetails
AS
SELECT 
    pj.JobID,
    pj.StudentID,
    u.Username AS StudentUsername,
    s.StudentCode,
    pj.PrinterID,
    pr.Name AS PrinterName,
    pr.Status AS PrinterStatus,
    pj.DocumentID,
    d.FileName,
    d.FileType,
    pj.ConfigID,
    pc.PaperSize,
    pc.Copies,
    pc.IsColor,
    pc.IsDoubleSided,
    pj.CUPSJobID,
    pj.Status,
    pj.TotalPages,
    pj.Cost,
    pj.StartTime,
    pj.EndTime,
    pj.QueuePosition,
    pj.IsRefunded
FROM PrintJobs pj
INNER JOIN Students s ON pj.StudentID = s.StudentID
INNER JOIN Users u ON s.StudentID = u.UserID
INNER JOIN Printers pr ON pj.PrinterID = pr.PrinterID
INNER JOIN Documents d ON pj.DocumentID = d.DocID
INNER JOIN PrintConfigs pc ON pj.ConfigID = pc.ConfigID;
GO

-- =============================================
-- COMPLETED - Tables, Indexes, Triggers, Views
-- =============================================

PRINT 'Database tables, indexes, triggers, and views created successfully!';
PRINT 'Total tables created:';
SELECT COUNT(*) AS TableCount FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE';
GO


