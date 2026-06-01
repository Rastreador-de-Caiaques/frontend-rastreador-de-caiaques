import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { CaiaqueService, StatusCaiaque, SessaoCaiaque } from '../services/caiaques.service';

@Component({
  selector: 'app-painel-status',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './painel-status.html',
  styleUrls: ['./painel-status.scss']
})
export class PainelStatus implements OnInit, OnDestroy {
  @Input() aberto = false;
  @Output() fechar = new EventEmitter<void>();

  servidorConectado = false;
  espBase: 'online' | 'aguardando' | 'offline' = 'aguardando';
  statusCaiaques: StatusCaiaque[] = [];

  private subs: Subscription[] = [];
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    public caiaqueService: CaiaqueService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.subs.push(
      this.caiaqueService.connected$.subscribe(v => {
        this.servidorConectado = v;
        this.cdr.detectChanges();
      }),
      this.caiaqueService.espBase$.subscribe(v => {
        this.espBase = v;
        this.cdr.detectChanges();
      }),
      this.caiaqueService.statusCaiaques$.subscribe(v => {
        this.statusCaiaques = v;
        this.cdr.detectChanges();
      })
    );

    this.tickTimer = setInterval(() => this.cdr.detectChanges(), 1000);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
    if (this.tickTimer) clearInterval(this.tickTimer);
  }

  fecharPainel(): void {
    this.fechar.emit();
  }

  tempoNoMar(sessao: SessaoCaiaque | undefined): string {
    if (!sessao?.primeiroSinal) return '--:--:--';
    const diff = Date.now() - sessao.primeiroSinal;
    const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
    const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
    const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  formatarHora(date: Date | null): string {
    if (!date) return '--';
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}
