package com.example.reference.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "perfiles")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Perfil {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "biografia")
    private String biografia;

    @Column(name = "telefono")
    private String telefono;

    @OneToOne(mappedBy = "perfil")
    private Cliente cliente;
}
