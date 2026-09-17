package com.example.inventoryapp.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "item_details")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ItemDetail {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "description")
    private String description;

    @OneToOne(mappedBy = "itemDetail")
    private Item item;
}
