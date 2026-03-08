/**
 * Types for Map Location Management
 */

export interface MapLocation {
  MapLocationID: string;
  PrinterID: string;
  X: number;
  Y: number;
  Floor: number;
  Building: string;
  Room: string;
  Description?: string | null;
}

export interface CreateMapLocationDto {
  PrinterID: string;
  X: number;
  Y: number;
  Floor?: number;
  Building?: string;
  Room?: string;
  Description?: string;
}

export interface UpdateMapLocationDto {
  X?: number;
  Y?: number;
  Floor?: number;
  Building?: string;
  Room?: string;
  Description?: string;
}

export interface PrinterWithLocation {
  PrinterID: string;
  Name: string;
  Status: string;
  MapLocationID?: string | null;
  X?: number | null;
  Y?: number | null;
  Floor?: number | null;
  Building?: string | null;
  Room?: string | null;
}

