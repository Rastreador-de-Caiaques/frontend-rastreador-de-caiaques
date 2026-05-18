import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { CaiaqueService, StatusCaiaque } from '../services/caiaques.service';

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

  constructor(
    private caiaqueService: CaiaqueService,
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
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  fecharPainel(): void {
    this.fechar.emit();
  }

  formatarHora(date: Date | null): string {
    if (!date) return '--';
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}
