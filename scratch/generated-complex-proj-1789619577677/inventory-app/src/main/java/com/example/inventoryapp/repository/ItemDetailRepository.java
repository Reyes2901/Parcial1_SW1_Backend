package com.example.inventoryapp.repository;

import com.example.inventoryapp.entity.ItemDetail;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ItemDetailRepository extends JpaRepository<ItemDetail, Long> {
}
