import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Caiaque } from '../services/caiaques.service';

@Component({
  selector: 'app-painel-caiaque',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './painel-caiaque.html',
  styleUrls: ['./painel-caiaque.scss']
})
export class PainelCaiaque implements OnChanges {
  @Input() caiaque: Caiaque | null = null;
  @Output() fechar = new EventEmitter<void>();
  @Output() mostrarRota = new EventEmitter<Caiaque>();

  visivel = false;

  ngOnChanges(): void {
    this.visivel = !!this.caiaque;
    if (this.caiaque) {
      this.mostrarRota.emit(this.caiaque);
    }
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