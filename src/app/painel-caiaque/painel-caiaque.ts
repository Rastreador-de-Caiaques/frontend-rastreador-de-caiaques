import { Component, Input, Output, EventEmitter, OnChanges, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Caiaque } from '../services/caiaques.service';

@Component({
  selector: 'app-painel-caiaque',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './painel-caiaque.html',
  styleUrls: ['./painel-caiaque.scss']
})
export class PainelCaiaque implements OnChanges, OnInit, OnDestroy {
  @Input() caiaque: Caiaque | null = null;
  @Output() fechar = new EventEmitter<void>();
  @Output() mostrarRota = new EventEmitter<Caiaque>();

  visivel = false;
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.tickTimer = setInterval(() => this.cdr.detectChanges(), 1000);
  }

  ngOnChanges(): void {
    this.visivel = !!this.caiaque;
    if (this.caiaque) {
      this.mostrarRota.emit(this.caiaque);
    }
  }

  ngOnDestroy(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
  }

  get tempoNoMar(): string {
    if (!this.caiaque?.primeiroSinal) return '--:--:--';
    const diff = Date.now() - this.caiaque.primeiroSinal;
    const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
    const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
    const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  formatarData(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString('pt-BR', {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  fecharPainel(): void {
    this.fechar.emit();
  }
}