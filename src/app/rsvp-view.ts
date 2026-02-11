import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

declare const supabase: {
  createClient: (url: string, key: string, options?: any) => any;
};

interface RsvpRow {
  id: string;
  name: string;
  email: string;
  guests: number;
  attendance: 'yes' | 'no' | 'maybe' | string;
  message: string | null;
  created_at: string;
}

@Component({
  selector: 'app-rsvp-view',
  templateUrl: './rsvp-view.html',
  styleUrl: './rsvp-view.css',
  standalone: false
})
export class RsvpViewComponent implements OnInit {
  protected weddingSlug = '';
  protected weddingLabel = '';
  protected rows: RsvpRow[] = [];
  protected isLoading = false;
  protected errorMessage = '';
  protected searchTerm = '';
  protected page = 1;
  protected pageSize = 10;

  private weddingId: string | null = null;
  private supabaseClient: any | null = null;
  private readonly supabaseUrl = 'https://sksxlvhyjkimyiiaxwtz.supabase.co';
  private readonly supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrc3hsdmh5amtpbXlpaWF4d3R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2OTQ1NTgsImV4cCI6MjA4NjI3MDU1OH0.wLYx_vlp6jNaW1jN82Ee9dL864kULIUkEc0c7Ruf2ig';

  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    if (this.supabaseUrl.startsWith('http') && this.supabaseAnonKey.length > 20 && typeof supabase !== 'undefined') {
      this.supabaseClient = supabase.createClient(this.supabaseUrl, this.supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });
    }
    this.route.paramMap.subscribe((params) => {
      const slug = (params.get('slug') ?? '').trim();
      if (!slug) {
        this.errorMessage = 'Invalid RSVP slug.';
        this.rows = [];
        return;
      }
      this.weddingSlug = slug;
      void this.loadBySlug(slug);
    });
  }

  protected setSearch(term: string): void {
    this.searchTerm = term;
    this.page = 1;
  }

  protected get filteredRows(): RsvpRow[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      return this.rows;
    }
    return this.rows.filter((row) =>
      [row.name, row.email, row.attendance, row.message ?? ''].some((value) =>
        String(value).toLowerCase().includes(term)
      )
    );
  }

  protected get pagedRows(): RsvpRow[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredRows.slice(start, start + this.pageSize);
  }

  protected get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredRows.length / this.pageSize));
  }

  protected nextPage(): void {
    if (this.page < this.totalPages) {
      this.page += 1;
    }
  }

  protected prevPage(): void {
    if (this.page > 1) {
      this.page -= 1;
    }
  }

  protected get totalGuestsYes(): number {
    return this.sumGuestsByAttendance('yes');
  }

  protected get totalGuestsNo(): number {
    return this.sumGuestsByAttendance('no');
  }

  protected get totalGuestsMaybe(): number {
    return this.sumGuestsByAttendance('maybe');
  }

  protected get totalGuestsAll(): number {
    return this.rows.reduce((sum, row) => sum + Number(row.guests || 0), 0);
  }

  private sumGuestsByAttendance(attendance: string): number {
    return this.rows
      .filter((row) => String(row.attendance).toLowerCase() === attendance)
      .reduce((sum, row) => sum + Number(row.guests || 0), 0);
  }

  private async loadBySlug(slug: string): Promise<void> {
    if (!this.supabaseClient) {
      this.errorMessage = 'Supabase client unavailable.';
      return;
    }
    this.isLoading = true;
    this.errorMessage = '';
    this.rows = [];
    this.weddingId = null;
    this.weddingLabel = '';
    try {
      const { data: wedding, error: weddingError } = await this.supabaseClient
        .from('weddings')
        .select('id, groom, bride, slug')
        .eq('slug', slug)
        .limit(1)
        .maybeSingle();

      if (weddingError || !wedding?.id) {
        this.errorMessage = `Wedding not found for slug: ${slug}`;
        return;
      }

      this.weddingId = wedding.id;
      this.weddingLabel = `${wedding.groom} & ${wedding.bride}`;

      const { data, error } = await this.supabaseClient
        .from('rsvp')
        .select('*')
        .eq('wedding_id', this.weddingId)
        .order('created_at', { ascending: false });

      if (error) {
        this.errorMessage = 'Unable to load RSVP rows.';
        return;
      }

      this.rows = (data ?? []) as RsvpRow[];
      this.page = 1;
    } finally {
      this.isLoading = false;
    }
  }
}

