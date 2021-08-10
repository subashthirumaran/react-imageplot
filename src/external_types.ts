export interface PlotManifest {
  version: string;
  plot_id: string;
  createtion_date: string;
  output_directory: string;
  layouts: {
    [layoutName: string]: {
      layout: string;
    };
  };
  initial_layout: string;
  point_sizes: {
    min: number;
    grid: number;
    max: number;
    scatter: number;
    initial: number;
    categorical: number;
    geographic: number;
  };
  imagelist: string;
  atlas_dir: string;
  metadata: boolean;
  default_hotspots: string;
  custom_hotspots: string;
  config: {
    sizes: {
      atlas: number;
      cell: number;
      lod: number;
    };
  };
}

export interface ImageList {
  cell_sizes: [width: number, height: number][][];
  images: string[];
  atlas: {
    count: number;
    positions: [number, number][][];
  };
}
