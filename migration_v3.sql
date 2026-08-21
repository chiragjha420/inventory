-- Database Schema Update (Migration V3)

-- Add optional tags column of type text array (defaulting to empty array) to products table
alter table products add column if not exists tags text[] default '{}'::text[] not null;
